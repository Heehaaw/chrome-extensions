# Tab Placement

A Manifest V3 extension for Microsoft Edge and other Chromium browsers. It opens new tabs next to
the current tab and inside the current tab's group, without reordering tabs the browser restores,
and names new tab groups after the Linear or GitLab ticket their tabs show.

## Behaviour

A new foreground tab that the browser appended to the end of the window (Cmd+T, the new-tab
button, or a link from another app) is moved directly after the tab that was active before it.
If that tab is in a group, the new tab joins the group. If it is pinned, the new tab goes right
after the pinned tabs.

The extension leaves these tabs alone:

- Tabs opened from a link in a page: the browser already places them next to their opener and in
  its group.
- Background tabs, such as those from "Open all" or session restore.
- Tabs created in the first 5 s after the browser starts, or in the first 2 s of a new window.
  These cover session restore and "Reopen closed window".
- A tab reopened with "Reopen closed tab", recognised by its URL and original index.

## Group names

When you create a tab group, it is named after the ticket ID its tabs show, such as `EXE-311`:

- Linear tabs: the issue ID from a `linear.app/<workspace>/issue/<ID>/…` address, otherwise the first ticket ID in the title.
- GitLab tabs (titles ending in `· GitLab`, or a `gitlab.` host): the first ticket ID in the title, such as a merge request's `EXE-257: …` or a lowercase branch
  name like `feat/exe-311-fix`.
- Linear wins when Linear and GitLab tabs show different tickets; otherwise the first tab in strip order wins.

Tabs from other sites are ignored. The name is set once, a second after the group is created, and only if the group has no name by then other than Edge's
default `Group <n>`. Tabs joining, leaving, or loading later never rename a group, and a group whose tabs show no ticket stays unnamed.

## Install

Store link: not published yet. Once the first version passes Chrome Web Store review, the link goes here.

Or download `tab-placement-<version>.zip` from the latest release and load it unpacked, as described in the [repository README](../README.md#install).
For development, load this folder's `extension/` directory directly.

Turn off other tab-position extensions; two of them moving the same tab will fight.

## Test

From the repository root, `bun run test` runs [the end-to-end tests](test/placement.test.js) in a throwaway Chromium profile. They cover placement next to the current tab,
joining a group in its middle and at its end, pinned tabs, a start mid-session, background tabs, "Reopen closed tab", session restore, and group naming.
[Unit tests](test/tickets.test.js) cover ticket parsing with Linear and GitLab title formats.

Tabs created through `chrome.tabs` report no opener, but a real Cmd/Ctrl+T tab has the current tab as its opener. On macOS,
`TAB_PLACEMENT_KEYBOARD=1 bun test tab-placement/test/keyboard.test.js` sends real Cmd+T to a visible Chromium window. It needs Accessibility permission for the terminal
and is skipped otherwise.

The session-restore test is a regression check only: Playwright's Chromium does not reproduce Edge's restore reordering even with a naive tab mover, so the restore guards are
verified by reasoning and by daily use in Edge.

`EXTENSION_DIR` runs the suite against a different extension folder.

## Store

[`store/listing.md`](store/listing.md) holds the Chrome Web Store listing and privacy answers, and [`PRIVACY.md`](PRIVACY.md) is the privacy policy. `bun run store:render`
regenerates the icons in `extension/icons/` and the images in `store/images/`.
