# Tab Placement privacy policy

Last updated: 2026-11-26

Tab Placement moves newly opened tabs next to the current tab and into its tab group, and names tab groups after the Linear or GitLab ticket their tabs show. It does
not collect, transmit, sell, or share any data. It has no server, analytics, or remote code.

## Data the extension handles on your device

To place tabs, the extension reads, in the browser on your device only:

- **Tab details:** each tab's position, window, pinned state, tab group, and the address (URL) of a newly opened tab.
- **Recently closed tabs:** the address and former position of tabs listed in the browser's recently closed list.
- **New tab groups:** the address and title of the tabs in a newly created tab group, and the group's name.

It compares a new tab's address and position with the recently closed list only to recognise **Reopen closed tab**, so a reopened tab returns to its old position instead of
being moved. It reads a new group's tab addresses and titles once, only to find a Linear or GitLab ticket ID and set it as the group's name.

## Storage

The extension keeps, in the browser's session storage (`chrome.storage.session`):

- the active and previously active tab of each window,
- when each window was opened and when the browser session started,
- the address and former position of recently closed tabs.

Session storage stays in memory on your device and is cleared when the browser closes. Nothing is written to disk by the extension, synced to other devices, or sent off the
device.

## Permissions

- `tabs`: read the details listed above and move or group new tabs.
- `tabGroups`: read a new group's name and name it.
- `sessions`: read the recently closed list.
- `storage`: keep the session data listed above.

## Contact

Report questions or problems at <https://github.com/Heehaaw/chrome-extensions/issues>.
