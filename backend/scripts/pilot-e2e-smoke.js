#!/usr/bin/env node
/**
 * Pre-deployment pilot: API reachability + database identity (must match pawsewa_chat / DB_NAME).
 * Does not mutate production data unless PILOT_JWT is set and optional steps are enabled.
 *
 * Usage (from repo root):
 *   node backend/scripts/pilot-e2e-smoke.js
 * Env (backend/.env loaded via dotenv from backend cwd):
 *   EXPECTED_DB_NAME=pawsewa_chat   (default; compared to GET /api/v1/health "database")
 *   PILOT_API_BASE=http://localhost:3000/api/v1  (optional override; else MONGO_URI host inferred minimally — use explicit base)
 *
 * Recommended:
 *   cd backend && set PILOT_API_BASE=http://127.0.0.1:3000/api/v1 && node scripts/pilot-e2e-smoke.js
 */

const path = require('path');
const fs = require('fs');

// Load backend/.env when run from repo root or backend/
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', 'backend', '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: p });
    break;
  }
}

const EXPECTED_DB = process.env.EXPECTED_DB_NAME || process.env.DB_NAME || 'pawsewa_chat';
const PORT = process.env.PORT || 3000;
const PILOT_API_BASE =
  process.env.PILOT_API_BASE ||
  process.env.API_BASE_URL ||
  `http://127.0.0.1:${PORT}/api/v1`;

function fail(msg) {
  console.error(`[PILOT FAIL] ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[PILOT OK] ${msg}`);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text };
  }
  return { res, data };
}

async function main() {
  console.log('[PILOT] API base:', PILOT_API_BASE);
  console.log('[PILOT] Expected DB name:', EXPECTED_DB);

  const healthUrl = `${PILOT_API_BASE.replace(/\/$/, '')}/health`;
  const { res, data } = await fetchJson(healthUrl);
  if (!res.ok) {
    fail(`Health HTTP ${res.status}. Is the backend running? (${healthUrl})`);
  }
  const dbReported = data.database;
  if (!dbReported || typeof dbReported !== 'string') {
    fail(`Health response missing "database" field: ${JSON.stringify(data)}`);
  }
  if (dbReported !== EXPECTED_DB) {
    fail(
      `Database mismatch: API reports "${dbReported}" but EXPECTED_DB_NAME/DB_NAME is "${EXPECTED_DB}". ` +
        'Fix backend/.env: set DB_NAME=pawsewa_chat and ensure MONGO_URI points at that database. ' +
        'The script does not auto-edit .env (secrets safety).',
    );
  }
  ok(`Health: database="${dbReported}" status=${data.status || 'n/a'}`);

  const ecoUrl = `${PILOT_API_BASE.replace(/\/$/, '')}/ecosystem/modules`;
  const eco = await fetchJson(ecoUrl);
  if (!eco.res.ok || !eco.data.success) {
    fail(`Ecosystem registry failed: ${eco.res.status} ${JSON.stringify(eco.data)}`);
  }
  const modules = eco.data.data && eco.data.data.modules;
  if (!Array.isArray(modules) || modules.length < 5) {
    fail(`Expected 5 ecosystem modules, got: ${modules && modules.length}`);
  }
  ok(`Ecosystem registry: ${modules.length} modules`);

  const hdrUrl = `${PILOT_API_BASE.replace(/\/$/, '')}/ping`;
  const ping = await fetch(hdrUrl, { method: 'GET' });
  const dbHeader = ping.headers.get('x-pawsewa-database');
  if (dbHeader && dbHeader !== EXPECTED_DB) {
    fail(`Header X-PawSewa-Database "${dbHeader}" !== expected "${EXPECTED_DB}"`);
  }
  if (dbHeader) {
    ok(`X-PawSewa-Database header: ${dbHeader}`);
  } else {
    console.log('[PILOT] Note: X-PawSewa-Database header absent (older server build?)');
  }

  console.log('[PILOT] Smoke checks passed. Full ghost-user E2E still requires auth tokens + UI automation.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
