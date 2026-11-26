# Chrome extensions

Independent Chromium extensions for Microsoft Edge and Chrome, maintained in one repository. Each extension owns its source and tests in its own folder. They share the root
test tooling, packaging and release scripts, and CI.

| Extension | Purpose |
| --- | --- |
| [Tab Placement](tab-placement/) | Open new tabs next to the current tab and inside its tab group, without reordering restored tabs. |

## Install

1. Download the extension's ZIP, for example `tab-placement-1.0.0.zip`, from the [latest release](https://github.com/Heehaaw/chrome-extensions/releases/latest).
2. Extract it into a folder you keep, for example `~/Extensions/tab-placement`. The browser loads the extension from that folder on every start, so do not delete it.
3. Open `edge://extensions` (or `chrome://extensions`), turn on **Developer mode**, choose **Load unpacked**, and select the folder.

To update, replace the folder's contents with a newer ZIP and choose **Reload** on the extension's card. Loading from a different folder registers a second copy with a new
extension ID.

Releases are ZIPs for **Load unpacked** rather than packed `.crx` files: Edge on macOS installs extensions from outside the Edge Add-ons store only through
[device management policy](https://learn.microsoft.com/deployedge/microsoft-edge-policies/extensionsettings).

To try an unreleased build, download `<extension>-0.0.0-dev.zip` from **Artifacts** of a successful
[Build, test, and package](https://github.com/Heehaaw/chrome-extensions/actions/workflows/build.yml) run and install it the same way. Artifact downloads require a GitHub
sign-in and expire after 90 days.

## Develop

Use [Bun](https://bun.sh) at the version pinned in `package.json` and run from the repository root:

```sh
bun install
bunx playwright install chromium
bun run test             # every extension's tests in a throwaway Chromium profile, plus release tooling tests
bun run package          # artifacts/input/<extension>-0.0.0-dev.zip
bun run release:verify   # promotes those ZIPs to artifacts/verification/ as v0.0.1
```

During development, load `<extension>/extension/` directly with **Load unpacked** and choose **Reload** after edits.

Branded Chrome and Edge ignore `--load-extension`, so tests use Playwright's Chromium. Set `CHROMIUM_PATH` to test against another Chromium or Chrome for Testing binary.

## CI and releases

Main and pull-request CI run every test, package each extension as a development ZIP, verify release promotion, and retain each ZIP for 90 days.

After main CI passes, open **Actions → Prepare release → Run workflow**. Select the tested branch and choose a patch, minor, major, or custom `vMAJOR.MINOR.PATCH` version.
The workflow downloads the successful main build's exact ZIPs, sets the release version in each `manifest.json`, and creates a draft release with every extension ZIP and
checksums. Review the linked draft in Releases and publish it manually as Latest. Tag pushes do not publish releases.

Release tags are the version source of truth. Development builds keep `0.0.0-dev`; no version-bump commit is needed after publication. See
[release guidelines](doc/release-guidelines.md).

## Add an extension

1. Create `<name>/extension/` with a Manifest V3 `manifest.json` using `"version": "0.0.0.1"` and `"version_name": "0.0.0-dev"`, and `<name>/test/*.test.js` using
   `bun:test`.
2. Add `<name>/README.md` and a row to the table above.
3. Add an upload step for `artifacts/input/<name>-0.0.0-dev.zip` to [the build workflow](.github/workflows/build.yml).

## License

MIT.
