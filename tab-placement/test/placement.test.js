// End-to-end tests: loads the unpacked extension into a throwaway Chromium profile and drives tabs
// through the extension's own chrome.* APIs. A tab created there has no opener and is appended to
// the end of the strip, which is how Edge creates a Cmd+T tab.
//
// CHROMIUM_PATH optionally points at a Chromium or Chrome for Testing binary; branded Chrome and
// Edge ignore --load-extension.

import { afterAll, beforeAll, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const EXTENSION_DIR = process.env.EXTENSION_DIR || path.resolve(import.meta.dir, "../extension");
const WINDOW_GRACE_MS = 2000;
const SETTLE_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let server;
let baseUrl;

beforeAll(() => {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (req) => {
      const name = new URL(req.url).pathname.slice(1);
      return new Response(`<title>${name}</title>${name}`, { headers: { "content-type": "text/html" } });
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(() => server.stop(true));

async function launch(userDataDir, extraArgs = []) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`, ...extraArgs],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  return { context, worker };
}

// Skips the startup and new-window grace periods so tests exercise placement immediately.
async function skipGracePeriods(worker) {
  await sleep(WINDOW_GRACE_MS + 100);
  await worker.evaluate(() => chrome.storage.session.set({ sessionStartedAt: 0 }));
}

// Opens one tab per name in the current window (which starts with a blank tab that gets closed).
async function openTabs(worker, names) {
  const ids = await worker.evaluate(
    async ({ base, names }) => {
      const [blank] = await chrome.tabs.query({ currentWindow: true });
      const ids = [];
      for (const name of names) {
        ids.push((await chrome.tabs.create({ url: `${base}/${name}`, active: false })).id);
      }
      await chrome.tabs.remove(blank.id);
      return ids;
    },
    { base: baseUrl, names },
  );
  return Object.fromEntries(names.map((name, i) => [name, ids[i]]));
}

async function activate(worker, tabId) {
  await worker.evaluate((id) => chrome.tabs.update(id, { active: true }), tabId);
  await sleep(SETTLE_MS);
}

async function newForegroundTab(worker, name) {
  const id = await worker.evaluate(
    async (url) => (await chrome.tabs.create({ url })).id,
    `${baseUrl}/${name}`,
  );
  await sleep(SETTLE_MS);
  return id;
}

// Returns the window's tabs as "name" or "name@groupId" strings, in strip order. Playwright's own
// about:blank start tab is ignored.
async function strip(worker) {
  return worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.filter((t) => (t.pendingUrl || t.url).startsWith("http")).map((t) => {
      const name = new URL(t.pendingUrl || t.url).pathname.slice(1);
      return t.groupId === -1 ? name : `${name}@${t.groupId}`;
    });
  });
}

function tempProfile() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tab-placement-"));
}

test("new tab opens right after the current tab", async () => {
  const { context, worker } = await launch(tempProfile());
  try {
    await skipGracePeriods(worker);
    const tabs = await openTabs(worker, ["a", "b", "c", "d"]);

    await activate(worker, tabs.b);
    await newForegroundTab(worker, "new");

    expect(await strip(worker)).toEqual(["a", "b", "new", "c", "d"]);
  } finally {
    await context.close();
  }
});

test("new tab joins the current tab's group, in the middle and at the end of the group", async () => {
  const { context, worker } = await launch(tempProfile());
  try {
    await skipGracePeriods(worker);
    const tabs = await openTabs(worker, ["a", "b", "c", "d"]);
    const group = await worker.evaluate((ids) => chrome.tabs.group({ tabIds: ids }), [tabs.b, tabs.c]);

    await activate(worker, tabs.b);
    await newForegroundTab(worker, "mid");
    await activate(worker, tabs.c);
    await newForegroundTab(worker, "end");

    expect(await strip(worker)).toEqual(["a", `b@${group}`, `mid@${group}`, `c@${group}`, `end@${group}`, "d"]);
  } finally {
    await context.close();
  }
});

test("new tab from a pinned tab opens right after the pinned tabs", async () => {
  const { context, worker } = await launch(tempProfile());
  try {
    await skipGracePeriods(worker);
    const tabs = await openTabs(worker, ["a", "b", "c"]);
    await worker.evaluate((id) => chrome.tabs.update(id, { pinned: true }), tabs.a);

    await activate(worker, tabs.a);
    await newForegroundTab(worker, "new");

    expect(await strip(worker)).toEqual(["a", "new", "b", "c"]);
  } finally {
    await context.close();
  }
});

test("background tabs stay at the end", async () => {
  const { context, worker } = await launch(tempProfile());
  try {
    await skipGracePeriods(worker);
    const tabs = await openTabs(worker, ["a", "b", "c"]);

    await activate(worker, tabs.a);
    await worker.evaluate((url) => chrome.tabs.create({ url, active: false }), `${baseUrl}/bg`);
    await sleep(SETTLE_MS);

    expect(await strip(worker)).toEqual(["a", "b", "c", "bg"]);
  } finally {
    await context.close();
  }
});

test("reopening the last closed tab restores it at its old position", async () => {
  const { context, worker } = await launch(tempProfile());
  try {
    await skipGracePeriods(worker);
    const tabs = await openTabs(worker, ["a", "b", "c", "d"]);

    await activate(worker, tabs.b);
    await worker.evaluate((id) => chrome.tabs.remove(id), tabs.d);
    await sleep(SETTLE_MS);
    await worker.evaluate(() => chrome.sessions.restore());
    await sleep(SETTLE_MS);

    expect(await strip(worker)).toEqual(["a", "b", "c", "d"]);
  } finally {
    await context.close();
  }
});

test("session restore keeps tab order and groups", async () => {
  const profile = tempProfile();
  const names = ["a", "b", "c", "d", "e", "f", "g", "h"];

  const first = await launch(profile);
  let expected;
  try {
    await skipGracePeriods(first.worker);
    const tabs = await openTabs(first.worker, names);
    await first.worker.evaluate((ids) => chrome.tabs.group({ tabIds: ids }), [tabs.c, tabs.d, tabs.e]);
    await activate(first.worker, tabs.f);
    // Group ids change across restarts, so compare membership by position only.
    expected = (await strip(first.worker)).map((t) => t.replace(/@\d+$/, "@group"));
    // Gives the session service time to write the current state to disk.
    await sleep(3000);
  } finally {
    await first.context.close();
  }

  const second = await launch(profile, ["--restore-last-session"]);
  try {
    await sleep(6000); // past the startup grace period, in case anything would move late
    const restored = (await strip(second.worker)).map((t) => t.replace(/@\d+$/, "@group"));
    expect(restored).toEqual(expected);
  } finally {
    await second.context.close();
  }
});
