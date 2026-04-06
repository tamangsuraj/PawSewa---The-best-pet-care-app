#!/usr/bin/env node
/**
 * Kill whatever is listening on PORT (default 3000). Windows + macOS/Linux.
 * Usage: node scripts/free-port.js [port]
 *   npm run free-port
 *   npm run free-port -- 3001
 */
const { execSync } = require('child_process');

const port = String(process.argv[2] || process.env.PORT || '3000').trim();

function main() {
  if (process.platform === 'win32') {
    let out = '';
    try {
      out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      console.log(`[free-port] Nothing found listening on :${port}`);
      return;
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || !t.includes('LISTENING')) {
        continue;
      }
      const parts = t.split(/\s+/).filter(Boolean);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) {
        pids.add(pid);
      }
    }
    if (pids.size === 0) {
      console.log(`[free-port] No LISTENING PID parsed for :${port}`);
      return;
    }
    for (const pid of pids) {
      try {
        console.log(`[free-port] taskkill /PID ${pid} /F`);
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
      } catch (e) {
        console.error(`[free-port] Could not kill PID ${pid}:`, e.message);
      }
    }
    return;
  }

  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
    });
    const pids = out
      .trim()
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (pids.length === 0) {
      console.log(`[free-port] Nothing listening on :${port}`);
      return;
    }
    for (const pid of pids) {
      console.log(`[free-port] kill -9 ${pid}`);
      execSync(`kill -9 ${pid}`, { stdio: 'inherit' });
    }
  } catch {
    console.log(`[free-port] Nothing found on :${port} (lsof)`);
  }
}

main();
