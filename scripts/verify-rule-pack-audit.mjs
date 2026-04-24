#!/usr/bin/env node
// Issue #13 trip-wire: every rule pack YAML under data/rules/scoping/
// must carry a complete rule_pack_audit block verified against real
// source documents.
//
//   rule_pack_audit:
//     findings_doc: docs/findings/...       (must exist on disk)
//     audit_verdict: PASS                   (string literal)
//     audit_date:    'YYYY-MM-DD'
//     source_pdfs:
//       - data/rules/scoping/reference/...  (each file must exist)
//
// Exits 0 when every pack passes, exits 1 with a diagnostic otherwise.
// Run in CI (separate step from `npm test`) so the trip-wire is visible
// in PR checks even if a test is accidentally skipped.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

const ROOT = resolve(process.cwd());
const PACK_DIR = join(ROOT, 'data', 'rules', 'scoping');

function listYaml(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.yaml') || n.endsWith('.yml'))
    .map((n) => join(dir, n));
}

function fail(msg) {
  process.stderr.write(`::error::verify-rule-pack-audit FAIL — ${msg}\n`);
  process.exit(1);
}

const files = listYaml(PACK_DIR);
if (files.length === 0) {
  fail(`no rule packs found under ${PACK_DIR} — audit cannot run`);
}

let ok = 0;
for (const file of files) {
  const raw = readFileSync(file, 'utf-8');
  const doc = yaml.load(raw);
  const audit = doc?.rule_pack_audit;

  if (!audit || typeof audit !== 'object') {
    fail(`${file} — missing rule_pack_audit block (see CLAUDE.md §9.3 ⑥)`);
  }
  if (audit.audit_verdict !== 'PASS') {
    fail(`${file} — audit_verdict must be 'PASS', got ${JSON.stringify(audit.audit_verdict)}`);
  }
  if (typeof audit.audit_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(audit.audit_date)) {
    fail(`${file} — audit_date must be 'YYYY-MM-DD', got ${JSON.stringify(audit.audit_date)}`);
  }

  if (typeof audit.findings_doc !== 'string') {
    fail(`${file} — findings_doc must be a string path`);
  }
  if (!existsSync(join(ROOT, audit.findings_doc))) {
    fail(`${file} — findings_doc missing on disk: ${audit.findings_doc}`);
  }

  if (!Array.isArray(audit.source_pdfs) || audit.source_pdfs.length === 0) {
    fail(`${file} — source_pdfs must be a non-empty array`);
  }
  for (const p of audit.source_pdfs) {
    if (typeof p !== 'string' || !existsSync(join(ROOT, p))) {
      fail(`${file} — source_pdf missing on disk: ${p}`);
    }
  }

  ok += 1;
}

process.stdout.write(`verify-rule-pack-audit: ${ok}/${files.length} rule pack(s) PASS\n`);
process.exit(0);
