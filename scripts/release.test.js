import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEV_VERSION_NAME, promote, releaseVersion } from "./release.js";

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "release-test-"));
  tempDirs.push(dir);
  return dir;
}

// Builds a development ZIP the same way scripts/package.sh does.
async function devZip(inputDir, name, manifest) {
  const source = path.join(tempDir(), name);
  mkdirSync(source);
  writeFileSync(path.join(source, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(path.join(source, "service_worker.js"), "console.log('unchanged');\n");
  const zip = path.join(inputDir, `${name}-${DEV_VERSION_NAME}.zip`);
  expect(Bun.spawnSync(["zip", "-qrX", zip, "."], { cwd: source }).exitCode).toBe(0);
  return zip;
}

const unzipText = (zip, entry) => Bun.spawnSync(["unzip", "-p", zip, entry]).stdout.toString();

// "unzip -v" lists each entry's CRC and compressed size, which change if the entry is rewritten.
const entryListing = (zip, entry) =>
  Bun.spawnSync(["unzip", "-v", zip]).stdout.toString().split("\n").find((line) => line.endsWith(` ${entry}`));

describe("releaseVersion", () => {
  test("Should_accept_a_semantic_version_tag", () => {
    expect(releaseVersion("v1.2.3")).toBe("1.2.3");
  });

  test.each(["1.2.3", "v1.2", "v01.2.3", "v1.2.3-rc1", "v0.0.0", "v65536.0.0", undefined])(
    "Should_reject_%p",
    (tag) => {
      expect(() => releaseVersion(tag)).toThrow();
    },
  );
});

describe("promote", () => {
  test("Should_set_the_release_version_and_keep_other_entries_unchanged", async () => {
    const inputDir = tempDir();
    const outputDir = path.join(tempDir(), "release");
    const input = await devZip(inputDir, "sample", { manifest_version: 3, name: "Sample", version: "0.0.0.1", version_name: DEV_VERSION_NAME });

    const [output] = await promote({ tag: "v1.4.2", inputDir, outputDir });

    expect(path.basename(output)).toBe("sample-1.4.2.zip");
    expect(JSON.parse(unzipText(output, "manifest.json"))).toEqual({ manifest_version: 3, name: "Sample", version: "1.4.2" });
    expect(entryListing(output, "service_worker.js")).toBe(entryListing(input, "service_worker.js"));
  });

  test("Should_reject_a_ZIP_without_the_development_version_name", async () => {
    const inputDir = tempDir();
    await devZip(inputDir, "sample", { manifest_version: 3, name: "Sample", version: "1.0.0" });

    await expect(promote({ tag: "v1.0.1", inputDir, outputDir: tempDir() })).rejects.toThrow(/version_name/);
  });

  test("Should_fail_when_no_development_ZIPs_exist", async () => {
    await expect(promote({ tag: "v1.0.0", inputDir: tempDir(), outputDir: tempDir() })).rejects.toThrow(/No \*-0\.0\.0-dev\.zip/);
  });
});
