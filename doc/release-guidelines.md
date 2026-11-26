# Release guidelines

All extensions share one release: a single tag carries every extension's ZIP. Release preparation follows the sibling `jetbrains-plugins` and `jellyfin-plugins` repositories'
tested-artifact promotion flow.

1. Run `bun run test`, `bun run package`, and `bun run release:verify`. Commit with this repository's GitHub signing identity and push main when authorized.
2. Wait for successful main push CI for that exact commit. The workflow retains each extension's `<name>-0.0.0-dev.zip` for 90 days.
3. Run **Actions → Prepare release** from the tested branch. Choose patch, minor, major, or a custom `vMAJOR.MINOR.PATCH` tag. Automatic bumps use the highest published stable
   release.
4. Follow the workflow summary's draft link. Review the versioned ZIPs and `SHA256SUMS`, then publish the draft manually as Latest.

Release preparation rejects a commit without successful main push CI, an extension folder without a retained ZIP, workflow files that differ from current main, an existing
release tag, or a tag pointing to another commit. Preparation jobs run serially. A tag push alone never publishes a release.

## Versions

Chrome requires `version` to be one to four integers that are not all zero, so the development placeholder lives in `version_name`. Each extension's source manifest keeps:

```json
"version": "0.0.0.1",
"version_name": "0.0.0-dev"
```

`bun run package` refuses any other `version_name`. [`scripts/release.js`](../scripts/release.js) rejects tags that are not valid Chrome versions, such as `v0.0.0` or numbers
above 65535. It copies each tested ZIP, sets `version` to the tag without its `v`, removes `version_name`, and replaces only `manifest.json` in the copy. Every other entry keeps
its compressed bytes, and `SHA256SUMS` describes the final ZIPs. Preparation does not rerun extension tests or rebuild anything.

Tab Placement's first CI build was versioned 1.0.0. Use **custom → v1.0.0** for the first release so an installed copy's version does not go backwards.

To exercise promotion locally:

```sh
bun run package
bun scripts/release.js --tag v1.2.3   # artifacts/input → artifacts/release
```

Releases are verified by CI and by loading the extracted ZIP in Chromium tests. Check the version shown on `edge://extensions` and the extension's behaviour in Edge before
claiming a release works there.
