# Tab Placement: Chrome Web Store listing

Copy these values into the Chrome Web Store Developer Dashboard. The name and summary come from `extension/manifest.json`; keep them in sync.

## Package

Upload `tab-placement-<version>.zip` from the latest [GitHub release](https://github.com/Heehaaw/chrome-extensions/releases/latest).

## Store listing

**Name:** Tab Placement

**Summary** (from the manifest description, 132 characters at most):

> Opens new tabs next to the current tab and inside its tab group, without reordering restored tabs.

**Description:**

> Browsers add a new tab (Cmd/Ctrl+T or the + button) at the far end of the window. Tab Placement opens it right next to the tab you are on instead, and inside that tab's
> group.
>
> • New tabs open directly after the current tab.
> • If the current tab is in a tab group, the new tab joins the group.
> • From a pinned tab, the new tab opens right after the pinned tabs.
> • Links opened from a page keep the browser's own placement.
> • Restored sessions, reopened windows, and Reopen closed tab keep their original order and positions.
>
> Works in Google Chrome and Microsoft Edge. No settings, no accounts, no data collection.
>
> Source code and issue tracker: https://github.com/Heehaaw/chrome-extensions

**Category:** Productivity → Workflow & Planning. If the dashboard's categories differ, choose the closest tab-management or productivity tools category.

**Language:** English

**Graphic assets** (regenerate with `bun run store:render`):

- Store icon: packaged as `extension/icons/icon-128.png`.
- Screenshot: [`images/screenshot-1280x800.png`](images/screenshot-1280x800.png)
- Small promo tile (optional): [`images/promo-tile-440x280.png`](images/promo-tile-440x280.png)

**Homepage URL:** https://github.com/Heehaaw/chrome-extensions/tree/main/tab-placement

**Support URL:** https://github.com/Heehaaw/chrome-extensions/issues

## Privacy practices

**Single purpose:**

> Open new tabs next to the current tab and inside its tab group.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `tabs` | Reads each new tab's position, window, pinned state, group, and URL so it can move the tab next to the current tab and add it to that tab's group. The URL is compared with the recently closed list to recognise Reopen closed tab. |
| `sessions` | Reads the recently closed tabs list so a tab restored with Reopen closed tab returns to its former position instead of being moved. |
| `storage` | Keeps the active tab history of each window in chrome.storage.session, which survives service-worker restarts and is cleared when the browser closes. |

**Remote code:** No, I am not using remote code.

**Data usage:** Select **Web history** (or the dashboard's web browsing activity category). The Chrome Web Store counts URLs handled only on the device as user data, and
Tab Placement reads tab URLs locally to recognise reopened tabs. Leave every other category unchecked. Tick every certification the dashboard shows; Tab Placement sells and transfers no data and uses
URLs only for its single purpose.

**Privacy policy URL:** https://github.com/Heehaaw/chrome-extensions/blob/main/tab-placement/PRIVACY.md

## Distribution

**Visibility:** Unlisted. Anyone with the store link can install it; it does not appear in search.

**Regions:** All regions.
