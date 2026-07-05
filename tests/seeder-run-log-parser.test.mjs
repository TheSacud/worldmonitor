import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classify, parseLog } from '../scripts/parse-seeder-run-log.mjs';

describe('seeder run log parser', () => {
  it('parses wrapper result lines and final summary', () => {
    const report = parseLog([
      '\u2192 seed-earthquakes.mjs ... OK',
      '\u2192 seed-ucdp-events.mjs ... FAIL (FATAL: No valid UCDP GED version found: HTTP 401)',
      '\u2192 seed-aviation.mjs ... SKIP (No AVIATIONSTACK_API key - skipping)',
      '\u2192 seed-slow.mjs ... TIMEOUT (killed after 180s)',
      '',
      'Done: 1 ok, 1 skipped, 1 failed, 1 timed out',
    ].join('\n'));

    assert.equal(report.parsedRows, 4);
    assert.deepEqual(report.summary, { ok: 1, skipped: 1, failed: 1, timedOut: 1 });
    assert.equal(report.byCause.ok, 1);
    assert.equal(report.byCause.missing_or_invalid_auth, 1);
    assert.equal(report.byCause.missing_api_key, 1);
    assert.equal(report.byCause.timeout, 1);
  });

  it('handles nonstandard arrow prefixes from shell logs', () => {
    const report = parseLog('mojibake-arrow seed-cyber-threats.mjs ... OK\n');
    assert.equal(report.parsedRows, 1);
    assert.equal(report.rows[0].seeder, 'seed-cyber-threats.mjs');
  });

  it('classifies common failure reasons', () => {
    assert.equal(classify('FAIL', 'HTTP 429 rate limit'), 'rate_limited');
    assert.equal(classify('FAIL', 'HTTP 403 forbidden by upstream'), 'upstream_blocked');
    assert.equal(classify('FAIL', 'TypeError: Cannot read properties'), 'runtime_bug');
    assert.equal(classify('FAIL', 'fetch failed: ECONNRESET'), 'network_or_upstream');
    assert.equal(classify('SKIP', 'no data returned'), 'no_data');
  });

  it('classifies bundle partial failures and scheduled skips', () => {
    assert.equal(classify('SKIP', '[Bundle:climate] Finished in 247.7s, ran:1 skipped:2 deferred:0 failed:2'), 'bundle_partial_failed');
    assert.equal(classify('SKIP', '[Bundle:macro] Finished in 0.1s, ran:0 skipped:13 deferred:0 failed:0'), 'not_due_or_deferred');
    assert.equal(classify('SKIP', '[bilateral-hs4] seed-meta is 0.2d old (gate=24d) - skipping'), 'not_due_or_deferred');
    assert.equal(classify('FAIL', 'Usage: node scripts/seed-consumer-prices.mjs --force'), 'requires_manual_force');
    assert.equal(classify('FAIL', '=== Failed gracefully (7102ms) ==='), 'graceful_failure_needs_detail');
  });
});
