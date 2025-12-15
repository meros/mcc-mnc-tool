import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testOutputPath = path.join(__dirname, 'test-output.json');
const benchmarkPath = path.join(__dirname, 'test-benchmark.json');

test('MCC/MNC tool - structure validation', async (t) => {
  // Cleanup from previous runs
  try {
    await fs.unlink(testOutputPath);
  } catch {}

  // Run script
  const { spawnSync } = await import('child_process');
  const result = spawnSync('node', ['index.mjs', '--output', testOutputPath], {
    stdio: 'inherit'
  });
  
  assert.strictEqual(result.status, 0, 'Script should exit with code 0');

  // Validate output
  const fileContent = await fs.readFile(testOutputPath, 'utf-8');
  const data = JSON.parse(fileContent);

  assert.ok(data.metadata?.generated, 'Should have generated timestamp');
  assert.ok(data.metadata?.source, 'Should have source URL');
  assert.ok(data.metadata?.etag, 'Should have etag');
  assert.ok(data.areas, 'Should have areas object');
  assert.ok(Array.isArray(data.areaNames), 'Should have areaNames array');
  assert.ok(Object.keys(data.areas).length > 0, 'Should have at least one area');

  // Cleanup
  await fs.unlink(testOutputPath);
});

test('MCC/MNC tool - content validation', async (t) => {
  // Cleanup from previous runs
  try {
    await fs.unlink(testOutputPath);
  } catch {}

  // Run script
  const { spawnSync } = await import('child_process');
  const result = spawnSync('node', ['index.mjs', '--output', testOutputPath], {
    stdio: 'inherit'
  });
  
  assert.strictEqual(result.status, 0, 'Script should exit with code 0');

  // Load actual and benchmark data
  const actualContent = await fs.readFile(testOutputPath, 'utf-8');
  const actual = JSON.parse(actualContent);
  
  const benchmarkContent = await fs.readFile(benchmarkPath, 'utf-8');
  const benchmark = JSON.parse(benchmarkContent);

  // Validate structure matches benchmark
  assert.ok(actual.metadata, 'Should have metadata object');
  assert.ok(actual.areas, 'Should have areas object');
  assert.ok(actual.areaNames, 'Should have areaNames array');

  // Validate all area names are strings
  assert.ok(actual.areaNames.every(name => typeof name === 'string'), 'All area names should be strings');

  // Validate areas structure
  for (const [areaKey, entries] of Object.entries(actual.areas)) {
    assert.ok(Array.isArray(entries), `Area "${areaKey}" should be an array`);
    for (const entry of entries) {
      assert.ok(entry.name, `Entry should have name in area "${areaKey}"`);
      assert.ok(entry.mcc, `Entry should have mcc in area "${areaKey}"`);
      assert.ok(entry.mnc, `Entry should have mnc in area "${areaKey}"`);
      assert.strictEqual(typeof entry.name, 'string', 'Entry name should be string');
      assert.strictEqual(typeof entry.mcc, 'string', 'Entry mcc should be string');
      assert.strictEqual(typeof entry.mnc, 'string', 'Entry mnc should be string');
    }
  }

  // Validate that we have a reasonable number of areas (at least as many as benchmark)
  assert.ok(
    Object.keys(actual.areas).length >= Object.keys(benchmark.areas).length,
    `Should have at least ${Object.keys(benchmark.areas).length} areas`
  );

  // Validate that we have a reasonable number of entries
  const actualEntriesCount = Object.values(actual.areas).flat().length;
  const benchmarkEntriesCount = Object.values(benchmark.areas).flat().length;
  assert.ok(
    actualEntriesCount >= benchmarkEntriesCount,
    `Should have at least ${benchmarkEntriesCount} entries, got ${actualEntriesCount}`
  );

  // Cleanup
  await fs.unlink(testOutputPath);
});