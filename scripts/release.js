// Promotes tested development ZIPs to release ZIPs without rebuilding them.
//
// Usage: bun scripts/release.js --tag vMAJOR.MINOR.PATCH [--input artifacts/input] [--output artifacts/release]
//
// Each <name>-0.0.0-dev.zip in the input directory becomes <name>-MAJOR.MINOR.PATCH.zip. Only manifest.json
// changes: "version" is set from the tag and the development "version_name" is removed. Every other entry
// keeps its compressed bytes, because zip replaces just the updated entry in a copy of the tested archive.

import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

export const DEV_VERSION_NAME = "0.0.0-dev";
const DEV_SUFFIX = `-${DEV_VERSION_NAME}.zip`;

/** Returns MAJOR.MINOR.PATCH for a vMAJOR.MINOR.PATCH tag that is also a valid Chrome manifest version. */
export function releaseVersion(tag) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag ?? "");
  if (!match) throw new Error(`Release tag must look like vMAJOR.MINOR.PATCH, got "${tag}".`);

  // Chrome accepts integers up to 65535 and rejects an all-zero version.
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 65535)) throw new Error(`Each version number in ${tag} must be at most 65535.`);
  if (parts.every((part) => part === 0)) throw new Error(`${tag} is not a valid extension version; use at least v0.0.1.`);
  return parts.join(".");
}

/** Promotes every development ZIP in inputDir and returns the paths of the release ZIPs. */
export async function promote({ tag, inputDir, outputDir }) {
  const version = releaseVersion(tag);
  // zip runs inside a temporary directory, so relative paths would resolve against it.
  inputDir = path.resolve(inputDir);
  outputDir = path.resolve(outputDir);
  const inputs = readdirSync(inputDir).filter((file) => file.endsWith(DEV_SUFFIX)).sort();
  if (inputs.length === 0) throw new Error(`No *${DEV_SUFFIX} files in ${inputDir}.`);

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const outputs = [];
  for (const input of inputs) {
    const name = input.slice(0, -DEV_SUFFIX.length);
    const output = path.join(outputDir, `${name}-${version}.zip`);
    await promoteOne(path.join(inputDir, input), output, version);
    outputs.push(output);
  }
  return outputs;
}

async function promoteOne(input, output, version) {
  const workDir = mkdtempSync(path.join(os.tmpdir(), "extension-release-"));
  try {
    await run(["unzip", "-q", input, "manifest.json", "-d", workDir]);
    const manifestFile = Bun.file(path.join(workDir, "manifest.json"));
    const manifest = await manifestFile.json();

    // Guards against promoting a ZIP that was not built from the development source.
    if (manifest.version_name !== DEV_VERSION_NAME) {
      throw new Error(`${input} has version_name "${manifest.version_name}", expected "${DEV_VERSION_NAME}".`);
    }
    manifest.version = version;
    delete manifest.version_name;
    await Bun.write(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

    copyFileSync(input, output);
    await run(["zip", "-qX", output, "manifest.json"], workDir);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function run(command, cwd) {
  const proc = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`${command.join(" ")} failed with exit code ${proc.exitCode}.`);
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      tag: { type: "string" },
      input: { type: "string", default: "artifacts/input" },
      output: { type: "string", default: "artifacts/release" },
    },
  });
  try {
    const outputs = await promote({ tag: values.tag, inputDir: values.input, outputDir: values.output });
    for (const output of outputs) console.log(output);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
