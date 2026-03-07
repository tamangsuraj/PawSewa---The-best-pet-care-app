/**
 * Structured logger for backend terminal output.
 * Format: [TIMESTAMP] [LEVEL] Message
 * No emojis or informal language.
 */

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  return `${y}-${mo}-${day} ${h}:${min}:${sec}`;
}

function format(level, ...args) {
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  return `[${timestamp()}] [${level}] ${msg}`;
}

const logger = {
  info(...args) {
    console.log(format('INFO', ...args));
  },
  success(...args) {
    console.log(format('SUCCESS', ...args));
  },
  event(...args) {
    console.log(format('EVENT', ...args));
  },
  warn(...args) {
    console.warn(format('WARN', ...args));
  },
  error(...args) {
    console.error(format('ERROR', ...args));
  },
};

module.exports = logger;
