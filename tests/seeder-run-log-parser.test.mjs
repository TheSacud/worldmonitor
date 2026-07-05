import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classify, parseLog } from '../scripts/parse-seeder-run-log.mjs';

describe('seeder run log parser', () => {
  it('parses wrapper result lines and final summary', () => {
    const report = parseLog([
      '→ seed-earthquakes.mjs ... OK',
      '→ seed-ucdp-events.mjs ... FAIL (FATAL: No valid UCDP GED version found: HTTP 401)',
      '→ seed-aviation.mjs ... SKIP (No AVIATIONSTACK_API key — skipping)',
      '→ seed-slow.mjs ... TIMEOUT (killed after 180s)',
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

  it('handles mojibake arrow from older shell logs', () => {
    const report = parseLog('â†’ seed-cyber-threats.mjs ... OK\n');
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
});
