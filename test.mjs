import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testOutputPath = path.join(__dirname, 'test-output.json');

test('MCC/MNC tool', async (t) => {
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