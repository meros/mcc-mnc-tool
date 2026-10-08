// End-to-end run against the live ITU website. Needs network access.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

test("CLI downloads and parses the latest ITU document", { timeout: 180_000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mcc-mnc-tool-"));
  const outputPath = path.join(dir, "data.json");

  try {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../index.mjs", import.meta.url)), "--output", outputPath],
      { stdio: "inherit" },
    );
    assert.equal(result.status, 0, "Script should exit with code 0");

    const data = JSON.parse(await fs.readFile(outputPath, "utf8"));
    assert.ok(data.metadata?.generated, "Should have generated timestamp");
    assert.match(data.metadata?.source ?? "", /^https:\/\/www\.itu\.int\/.+\.docx$/);
    assert.ok(data.metadata?.etag, "Should have etag");
    assert.ok(Array.isArray(data.areaNames), "Should have areaNames array");
    assert.ok(data.areaNames.length > 150, "Should have most areas of the world");

    const entries = Object.values(data.areas).flat();
    assert.ok(entries.length > 1000, "Should have many entries");
    for (const e of entries) {
      assert.match(e.mcc, /^\d{3}$/, `bad MCC in ${JSON.stringify(e)}`);
      assert.match(e.mnc, /^\d{2,3}$/, `bad MNC in ${JSON.stringify(e)}`);
      assert.ok(e.name, `empty name in ${JSON.stringify(e)}`);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
