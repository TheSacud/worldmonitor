#!/usr/bin/env node

import { readFileSync } from 'node:fs';

function usage() {
  console.error('Usage: node scripts/parse-seeder-run-log.mjs <log-file> [--format=json|markdown]');
  process.exit(2);
}

function classify(status, reason) {
  const text = String(reason || '').toLowerCase();
  if (status === 'OK') return 'ok';
  if (status === 'TIMEOUT') return 'timeout';
  if (/\b(no|missing)\b.*\b(api[_ -]?key|key|token|auth|credential|secret)\b/.test(text)) return 'missing_api_key';
  if (/\b(api[_ -]?key|token|auth|credential|secret)\b.*\b(not set|missing|required|not configured|none)\b/.test(text)) return 'missing_api_key';
  if (/\b401\b|unauthenticated|unauthorized|invalid api key|invalid token/.test(text)) return 'missing_or_invalid_auth';
  if (/\b429\b|rate limit|too many requests|quota/.test(text)) return 'rate_limited';
  if (/\b403\b|forbidden|blocked|cloudflare|akamai|captcha/.test(text)) return 'upstream_blocked';
  if (/enotfound|eai_again|econnreset|etimedout|network|fetch failed|socket hang up/.test(text)) return 'network_or_upstream';
  if (/err_module_not_found|cannot find module|syntaxerror|typeerror|referenceerror|enoent|eacces/.test(text)) return 'runtime_bug';
  if (/no data|empty|0 records|0 rows|no rows|no flights|no events|no alerts/.test(text)) return 'no_data';
  if (status === 'SKIP') return 'skipped';
  if (status === 'FAIL') return 'failed_unknown';
  return 'unknown';
}

function parseLog(text) {
  const rows = [];
  let summary = null;
  const seederLine = /^(?:→|â†’)\s+(seed-[^\s]+\.mjs)\s+\.\.\.\s+(OK|SKIP|FAIL|TIMEOUT)(?:\s+\((.*)\))?\s*$/;
  const doneLine = /^Done:\s+(\d+)\s+ok,\s+(\d+)\s+skipped,\s+(\d+)\s+failed,\s+(\d+)\s+timed out/i;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const seederMatch = seederLine.exec(line);
    if (seederMatch) {
      const [, seeder, status, reason = ''] = seederMatch;
      rows.push({
        seeder,
        status,
        reason,
        cause: classify(status, reason),
      });
      continue;
    }

    const doneMatch = doneLine.exec(line.trim());
    if (doneMatch) {
      summary = {
        ok: Number(doneMatch[1]),
        skipped: Number(doneMatch[2]),
        failed: Number(doneMatch[3]),
        timedOut: Number(doneMatch[4]),
      };
    }
  }

  const byStatus = {};
  const byCause = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    byCause[row.cause] = (byCause[row.cause] || 0) + 1;
  }

  return {
    parsedAt: new Date().toISOString(),
    summary: summary || {
      ok: byStatus.OK || 0,
      skipped: byStatus.SKIP || 0,
      failed: byStatus.FAIL || 0,
      timedOut: byStatus.TIMEOUT || 0,
    },
    parsedRows: rows.length,
    byStatus,
    byCause,
    rows,
  };
}

function markdown(report) {
  const lines = [];
  const s = report.summary;
  lines.push(`# Seeder Run Report`);
  lines.push('');
  lines.push(`Parsed rows: ${report.parsedRows}`);
  lines.push(`Summary: ${s.ok} OK, ${s.skipped} skipped, ${s.failed} failed, ${s.timedOut} timed out`);
  lines.push('');
  lines.push(`| Cause | Count |`);
  lines.push(`| --- | ---: |`);
  for (const [cause, count] of Object.entries(report.byCause).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cause} | ${count} |`);
  }
  lines.push('');
  lines.push(`| Seeder | Status | Cause | Reason |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const row of report.rows.filter((r) => r.status !== 'OK')) {
    const reason = row.reason.replace(/\|/g, '\\|');
    lines.push(`| ${row.seeder} | ${row.status} | ${row.cause} | ${reason} |`);
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) usage();
  const formatArg = process.argv.find((arg) => arg.startsWith('--format='));
  const format = formatArg ? formatArg.slice('--format='.length) : 'json';
  const report = parseLog(readFileSync(file, 'utf8'));
  if (format === 'markdown') {
    process.stdout.write(markdown(report));
  } else if (format === 'json') {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    usage();
  }
}

export { classify, parseLog, markdown };
