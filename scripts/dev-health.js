#!/usr/bin/env node
/**
 * Dev health helper for PawSewa.
 *
 * - Lists which PIDs are listening on common dev ports
 * - Optionally kills those listeners (Windows / Linux / macOS)
 * - Useful when Next.js gets into a stale state and CSS assets 404
 */
const { execSync } = require('node:child_process');

const PORTS = [3000, 3001, 3002];

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function isWindows() {
  return process.platform === 'win32';
}

function parseListeningPidsForPort(port) {
  if (isWindows()) {
    // Example:
    // TCP    0.0.0.0:3001  0.0.0.0:0  LISTENING  30864
    let out = '';
    try {
      out = sh(`cmd.exe /c "netstat -ano | findstr :${port}"`).trim();
    } catch {
      // findstr returns exit code 1 when no matches are found.
      out = '';
    }
    if (!out) return [];
    const pids = [];
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const cols = line.trim().split(/\s+/);
      const pid = cols[cols.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.push(pid);
    }
    return unique(pids);
  }

  // Linux/macOS: lsof is the most reliable, but not always installed.
  // Fallback to `netstat -anp` style output if available.
  try {
    const out = sh(`lsof -nP -iTCP:${port} -sTCP:LISTEN 2>/dev/null | tail -n +2`).trim();
    if (!out) return [];
    return unique(
      out
        .split(/\r?\n/)
        .map((l) => l.trim().split(/\s+/)[1])
        .filter(Boolean)
    );
  } catch {
    return [];
  }
}

function describePid(pid) {
  if (isWindows()) {
    try {
      const out = sh(`powershell -NoProfile -Command "Get-Process -Id ${pid} | Select-Object -ExpandProperty ProcessName"`)
        .trim();
      return out ? `${pid} (${out})` : pid;
    } catch {
      return pid;
    }
  }

  return pid;
}

function killPid(pid) {
  if (isWindows()) {
    sh(`cmd.exe /c "taskkill /PID ${pid} /F"`);
    return;
  }
  sh(`kill -9 ${pid}`);
}

function main() {
  const args = new Set(process.argv.slice(2));
  const shouldKill = args.has('--kill');

  const byPort = new Map();
  for (const port of PORTS) {
    const pids = parseListeningPidsForPort(port);
    byPort.set(port, pids);
  }

  const any = Array.from(byPort.values()).some((p) => p.length > 0);
  if (!any) {
    console.log('[OK] No listeners found on ports', PORTS.join(', '));
    process.exit(0);
  }

  for (const port of PORTS) {
    const pids = byPort.get(port) || [];
    if (pids.length === 0) {
      console.log(`[OK] :${port} is free`);
      continue;
    }
    console.log(`[WARN] :${port} is in use by: ${pids.map(describePid).join(', ')}`);
  }

  if (!shouldKill) {
    console.log('\nRun with `--kill` to stop these listeners.');
    process.exit(0);
  }

  const toKill = unique(Array.from(byPort.values()).flat());
  for (const pid of toKill) {
    try {
      killPid(pid);
      console.log(`[KILLED] ${describePid(pid)}`);
    } catch (e) {
      console.log(`[FAILED] ${pid}: ${String(e)}`);
    }
  }
}

main();

