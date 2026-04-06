#!/usr/bin/env node
/**
 * Stops local ngrok agent(s) then starts a tunnel to port 3000.
 * Fixes ERR_NGROK_334 when a previous ngrok.exe is still running on Windows.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');

const PORT = process.env.NGROK_PORT || '3000';
const extraArgs = process.argv.slice(2);

function killLocalNgrok() {
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /F /IM ngrok.exe', { stdio: 'ignore' });
    } catch (_) {
      /* no ngrok running */
    }
  } else {
    try {
      execSync('pkill -x ngrok || true', { stdio: 'ignore', shell: true });
    } catch (_) {
      /* ignore */
    }
  }
}

killLocalNgrok();

const args = ['http', PORT, '--pooling-enabled', ...extraArgs];
const child = spawn('ngrok', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: path.join(__dirname, '..'),
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code == null ? 0 : code);
});
