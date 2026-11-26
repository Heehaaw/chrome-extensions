# Chrome extensions

Independent Chromium extensions for Microsoft Edge and Chrome, maintained in one repository. Each extension owns its source and tests in its own folder. They share the root
test tooling, packaging script, and CI.

| Extension | Purpose |
| --- | --- |
| [Tab Placement](tab-placement/) | Open new tabs next to the current tab and inside its tab group, without reordering restored tabs. |

## Install from a build artifact

1. Open the latest successful [Build, test, and package](https://github.com/Heehaaw/chrome-extensions/actions/workflows/build.yml) run on `main` and download the extension's ZIP from **Artifacts**. You must be
   signed in to GitHub. Artifacts are kept for 90 days.
2. Extract the ZIP into a folder you keep, for example `~/Extensions/tab-placement`. The browser loads the extension from that folder on every start, so do not delete it.
3. Open `edge://extensions` (or `chrome://extensions`), turn on **Developer mode**, choose **Load unpacked**, and select the folder.

To update, replace the folder's contents with a newer ZIP and choose **Reload** on the extension's card. Loading from a different folder registers a second copy with a new
extension ID.

Builds are ZIPs for **Load unpacked** rather than packed `.crx` files: Edge on macOS installs extensions from outside the Edge Add-ons store only through
[device management policy](https://learn.microsoft.com/deployedge/microsoft-edge-policies/extensionsettings).

## Develop

Use Node.js 22 or later and run from the repository root:

```sh
npm install
npx playwright install chromium
npm test          # every extension's tests, in a throwaway Chromium profile
npm run package   # artifacts/<extension>-<version>.zip
```

During development, load `<extension>/extension/` directly with **Load unpacked** and choose **Reload** after edits.

Branded Chrome and Edge ignore `--load-extension`, so tests use Playwright's Chromium. Set `CHROMIUM_PATH` to test against another Chromium or Chrome for Testing binary.

## CI

Main and pull-request CI run every extension's tests in Chromium, package each extension, and retain its ZIP for 90 days. The ZIP's version comes from the extension's
`manifest.json`.

## Add an extension

1. Create `<name>/extension/` with a Manifest V3 `manifest.json`, and `<name>/test/*.test.cjs`.
2. Add `<name>/README.md` and a row to the table above.
3. Add an upload step for `artifacts/<name>-*.zip` to [the build workflow](.github/workflows/build.yml).

## License

MIT.
