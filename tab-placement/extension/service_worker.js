// Tab Placement: moves a new foreground tab next to the tab that was active before it, and into
// that tab's group. Tabs the browser positions itself (session restore, "Reopen closed tab",
// link-opened tabs, background tabs) are left alone, so restored windows keep their order.
// It also names each new tab group after the Linear or GitLab ticket its tabs show.

importScripts("tickets.js");

// Session restore and "Reopen closed window" create tabs in bursts right after the browser or a
// window appears; nothing is moved inside these windows.
const STARTUP_GRACE_MS = 5000;
const WINDOW_GRACE_MS = 2000;

// The recently-closed list may change before or after the reopened tab's onCreated event,
// so entries are matched for a short time after they leave the list.
const REOPEN_MATCH_MS = 5000;

const NO_GROUP = chrome.tabGroups.TAB_GROUP_ID_NONE;

// Grouping tabs creates the group before adding them, and Edge names a new group "Group <n>"
// about 300 ms later; naming waits until both have happened.
const GROUP_NAMING_DELAY_MS = 1000;

// Edge's default name for a new group (English UI). It counts as unnamed.
const DEFAULT_GROUP_TITLE = /^Group \d+$/;

// All state lives in storage.session: it survives service-worker restarts and is cleared when
// the browser quits, which is exactly the lifetime of window and activation history.
const SESSION_STARTED_KEY = "sessionStartedAt";
const RECENTLY_CLOSED_KEY = "recentlyClosed";
const windowKey = (windowId) => `window:${windowId}`;

// Handlers read-modify-write shared state and await browser calls, so they run one at a time
// in event order.
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch((error) => console.error("Tab Placement:", error));
  return queue;
}

chrome.runtime.onStartup.addListener(() => enqueue(() => startSession(Date.now())));
chrome.runtime.onInstalled.addListener(() => enqueue(() => startSession(Date.now())));

chrome.windows.onCreated.addListener((window) => {
  const createdAt = Date.now();
  enqueue(() => updateWindow(window.id, (record) => ({ ...record, createdAt })));
});

chrome.windows.onRemoved.addListener((windowId) => {
  enqueue(() => chrome.storage.session.remove(windowKey(windowId)));
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  enqueue(() =>
    updateWindow(windowId, (record) =>
      record.activeTabId === tabId ? record : { ...record, activeTabId: tabId, previousTabId: record.activeTabId },
    ),
  );
});

chrome.sessions.onChanged.addListener(() => enqueue(refreshRecentlyClosed));

chrome.tabs.onCreated.addListener((tab) => {
  const createdAt = Date.now();
  enqueue(() => placeNewTab(tab, createdAt));
});

// A pending timer keeps the service worker alive, so the delay needs no persisted state.
chrome.tabGroups.onCreated.addListener((group) => {
  setTimeout(() => enqueue(() => nameNewGroup(group.id)), GROUP_NAMING_DELAY_MS);
});

async function startSession(now) {
  await chrome.storage.session.set({ [SESSION_STARTED_KEY]: now });
  await recordActiveTabs();
  await refreshRecentlyClosed();
}

// Windows already open when the extension is installed, reloaded, or updated get no onActivated
// until the user switches tabs; recording their active tabs lets the first new tab be placed.
async function recordActiveTabs() {
  for (const tab of await chrome.tabs.query({ active: true })) {
    await updateWindow(tab.windowId, (record) => (record.activeTabId === undefined ? { ...record, activeTabId: tab.id } : record));
  }
}

async function updateWindow(windowId, update) {
  const key = windowKey(windowId);
  const { [key]: record = {} } = await chrome.storage.session.get(key);
  await chrome.storage.session.set({ [key]: update(record) });
}

async function placeNewTab(tab, createdAt) {
  // Background tabs come from links or bulk actions (restore, "Open all") that must keep their order.
  if (!tab.active || tab.pinned) return;
  if (await isWithinStartupGrace(createdAt)) return;

  const { [windowKey(tab.windowId)]: record } = await chrome.storage.session.get(windowKey(tab.windowId));
  if (!record) return;
  if (record.createdAt !== undefined && createdAt - record.createdAt < WINDOW_GRACE_MS) return;

  // onActivated for the new tab may already have been recorded; the anchor is the tab before it.
  const anchorId = record.activeTabId === tab.id ? record.previousTabId : record.activeTabId;
  if (anchorId === undefined || anchorId === tab.id) return;

  // Cmd/Ctrl+T and the new tab button make the current tab the opener of a tab appended at the end.
  // A foreground link tab has the same opener but the browser puts it right after it, so the
  // index check below leaves it alone. Any other opener is a page in another tab.
  if (tab.openerTabId !== undefined && tab.openerTabId !== anchorId) return;

  const window = await chrome.windows.get(tab.windowId, { populate: true });
  if (window.type !== "normal") return;

  const newTab = window.tabs.find((t) => t.id === tab.id);
  const anchor = window.tabs.find((t) => t.id === anchorId);
  if (!newTab || !anchor) return;

  // Only tabs appended at the end need help; any other index was chosen deliberately.
  if (newTab.index !== window.tabs.length - 1) return;
  if (await wasRecentlyClosed(newTab, createdAt)) return;

  await placeNextTo(newTab, anchor, window.tabs);
}

async function placeNextTo(newTab, anchor, tabs) {
  // Group first: joining a group can move the tab, and a later move within the group's span
  // keeps its membership.
  if (anchor.groupId !== NO_GROUP && newTab.groupId !== anchor.groupId) {
    await chrome.tabs.group({ groupId: anchor.groupId, tabIds: newTab.id });
  }

  // An unpinned tab cannot sit among pinned tabs; the closest spot is right after them.
  const targetIndex = anchor.pinned ? tabs.filter((t) => t.pinned).length : (await chrome.tabs.get(anchor.id)).index + 1;
  const { index: currentIndex } = await chrome.tabs.get(newTab.id);
  if (currentIndex !== targetIndex) {
    await chrome.tabs.move(newTab.id, { index: targetIndex });
  }
}

async function isWithinStartupGrace(now) {
  let { [SESSION_STARTED_KEY]: startedAt } = await chrome.storage.session.get(SESSION_STARTED_KEY);
  if (startedAt === undefined) {
    // Fallback when onStartup was not delivered; err on the side of not moving anything.
    startedAt = now;
    await chrome.storage.session.set({ [SESSION_STARTED_KEY]: startedAt });
  }
  return now - startedAt < STARTUP_GRACE_MS;
}

// "Reopen closed tab" restores a tab at its old index. When that index was the end of the
// strip, it looks like a new tab, so it is recognised by URL and index instead.
async function refreshRecentlyClosed() {
  const now = Date.now();
  const sessions = await chrome.sessions.getRecentlyClosed();
  const current = sessions.filter((s) => s.tab).map((s) => ({ url: s.tab.url, index: s.tab.index }));

  const { [RECENTLY_CLOSED_KEY]: previous = [] } = await chrome.storage.session.get(RECENTLY_CLOSED_KEY);
  const lingering = previous
    .filter((entry) => !current.some((c) => sameEntry(c, entry)))
    .map((entry) => ({ ...entry, removedAt: entry.removedAt ?? now }))
    .filter((entry) => now - entry.removedAt < REOPEN_MATCH_MS);

  await chrome.storage.session.set({ [RECENTLY_CLOSED_KEY]: [...current, ...lingering] });
}

async function wasRecentlyClosed(tab, now) {
  const url = tab.pendingUrl || tab.url;
  if (!url) return false;

  const { [RECENTLY_CLOSED_KEY]: entries = [] } = await chrome.storage.session.get(RECENTLY_CLOSED_KEY);
  return entries.some(
    (entry) =>
      sameEntry(entry, { url, index: tab.index }) &&
      (entry.removedAt === undefined || now - entry.removedAt < REOPEN_MATCH_MS),
  );
}

function sameEntry(a, b) {
  return a.url === b.url && a.index === b.index;
}

// Names a group once, shortly after it is created, so its tabs have joined it and started loading.
// Later changes to the group or its tabs never rename it, and a name set in the meantime (by the
// user or by session restore) is kept, except Edge's default name.
async function nameNewGroup(groupId) {
  const group = await chrome.tabGroups.get(groupId).catch(() => undefined);
  if (!group || (group.title && !DEFAULT_GROUP_TITLE.test(group.title))) return;

  const ticket = groupTicket(await chrome.tabs.query({ groupId }));
  if (ticket) await chrome.tabGroups.update(groupId, { title: ticket });
}
