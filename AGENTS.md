# Repository rules

- Keep each extension in its own top-level folder: browser-loadable files in `<name>/extension/`, tests in `<name>/test/`, documentation in `<name>/README.md`. Share test
  tooling, packaging, and workflows from the root.
- Read the extension's README before editing. Keep changes focused and request only the permissions an extension uses.
- Use Manifest V3 and standard `chrome.*` APIs that both Edge and Chrome support. Verify API behaviour against current Chrome extension documentation.
- Run `npm test` after implementation changes and `npm run package` after packaging or manifest changes.
- Bump an extension's `manifest.json` version when its behaviour changes; CI names the ZIP after it.
- Keep Git identity and signing configuration local to this repository. Never expose credentials or private keys.
