# Repository rules

- Keep each extension in its own top-level folder: browser-loadable files in `<name>/extension/`, tests in `<name>/test/`, documentation in `<name>/README.md`. Share test
  tooling, packaging, and workflows from the root.
- Read the extension's README before editing. Keep changes focused and request only the permissions an extension uses.
- Use Manifest V3 and standard `chrome.*` APIs that both Edge and Chrome support. Verify API behaviour against current Chrome extension documentation.
- Use Bun for dependencies, scripts, and tests. Run `bun run test` after implementation changes, and `bun run package` and `bun run release:verify` after packaging, manifest, or release changes.
- Keep each source manifest at `"version": "0.0.0.1"` and `"version_name": "0.0.0-dev"`. Release tags set versions; follow [release guidelines](doc/release-guidelines.md).
  Main CI retains tested ZIPs; manual preparation promotes them into a draft. Publication stays manual.
- Keep Git identity and signing configuration local to this repository. Never expose credentials or private keys.
