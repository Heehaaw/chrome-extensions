// Opt-in macOS test with a real Cmd+T: Chromium makes the current tab the opener of a Cmd+T tab
// before onCreated fires, which tabs.create cannot reproduce. It opens a visible Chromium window
// and needs Accessibility permission for the terminal running it. Run with
// `TAB_PLACEMENT_KEYBOARD=1 bun test tab-placement/test/keyboard.test.js`.

import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const EXTENSION_DIR = process.env.EXTENSION_DIR || path.resolve(import.meta.dir, "../extension");
const SEND_CMD_T = path.resolve(import.meta.dir, "send-cmd-t.swift");
const WINDOW_GRACE_MS = 2000;
const SETTLE_MS = 800;
const enabled = process.platform === "darwin" && process.env.TAB_PLACEMENT_KEYBOARD === "1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test.skipIf(!enabled)("Cmd+T opens the new tab after the current tab and inside its group", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tab-placement-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await sleep(WINDOW_GRACE_MS + 100);
    await worker.evaluate(() => chrome.storage.session.set({ sessionStartedAt: 0 }));

    // The browser process is the one Playwright launched with this profile.
    const browserPid = Bun.spawnSync(["pgrep", "-f", "--", `--user-data-dir=${userDataDir}`])
      .stdout.toString()
      .split("\n")
      .map(Number)
      .find((pid) => pid && !Bun.spawnSync(["ps", "-o", "command=", "-p", String(pid)]).stdout.toString().includes("--type="));
    expect(browserPid).toBeDefined();

    const pressCmdT = async () => {
      const result = Bun.spawnSync(["swift", SEND_CMD_T, String(browserPid)]);
      expect(result.stderr.toString()).toBe("");
      await sleep(SETTLE_MS);
    };
    const activate = async (tabId) => {
      await worker.evaluate((id) => chrome.tabs.update(id, { active: true }), tabId);
      await sleep(SETTLE_MS);
    };

    const tabs = await worker.evaluate(async () => {
      const [blank] = await chrome.tabs.query({ currentWindow: true });
      const ids = {};
      for (const name of ["a", "b", "c", "d"]) {
        ids[name] = (await chrome.tabs.create({ url: `data:text/html,<title>${name}</title>`, active: false })).id;
      }
      await chrome.tabs.remove(blank.id);
      await chrome.tabs.group({ tabIds: [ids.c, ids.d] });
      return ids;
    });

    await activate(tabs.a);
    await pressCmdT();
    await activate(tabs.c);
    await pressCmdT();

    const strip = await worker.evaluate(async () =>
      (await chrome.tabs.query({ currentWindow: true })).map((t) => `${t.title}${t.groupId === -1 ? "" : " (grouped)"}`),
    );
    expect(strip).toEqual(["a", "New Tab", "b", "c (grouped)", "New Tab (grouped)", "d (grouped)"]);
  } finally {
    await context.close();
  }
});
