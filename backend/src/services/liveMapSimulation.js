const logger = require('../utils/logger');
const LiveLocation = require('../models/LiveLocation');
const { getIO } = require('../sockets/socketStore');

const JITTER = 0.0005;
const KTM_BOUNDS = { latMin: 27.64, latMax: 27.82, lngMin: 85.28, lngMax: 85.42 };

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function jitterCoord(v) {
  return v + (Math.random() * 2 - 1) * JITTER;
}

async function tick() {
  const docs = await LiveLocation.find({ isDynamic: true });
  if (!docs.length) return;

  const updates = [];
  for (const doc of docs) {
    doc.lat = clamp(jitterCoord(doc.lat), KTM_BOUNDS.latMin, KTM_BOUNDS.latMax);
    doc.lng = clamp(jitterCoord(doc.lng), KTM_BOUNDS.lngMin, KTM_BOUNDS.lngMax);
    // eslint-disable-next-line no-await-in-loop
    await doc.save();
    updates.push({
      id: doc._id.toString(),
      key: doc.key,
      lat: doc.lat,
      lng: doc.lng,
      category: doc.category,
    });
  }

  const io = getIO();
  if (io && updates.length) {
    io.to('admin_room').emit('live_map:tick', { updates });
  }
}

let intervalId = null;

/**
 * Every 5s, nudge simulated rider/vet coordinates and broadcast to admin_room.
 * Disable with LIVE_MAP_SIMULATION=false
 */
function startLiveMapSimulation() {
  const enabled = String(process.env.LIVE_MAP_SIMULATION || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('Live map simulation: disabled (LIVE_MAP_SIMULATION=false)');
    return;
  }
  if (intervalId) return;

  const ms = Math.max(3000, Number(process.env.LIVE_MAP_TICK_MS) || 5000);
  intervalId = setInterval(() => {
    tick().catch((e) => logger.warn('Live map simulation tick failed:', e?.message || e));
  }, ms);

  setTimeout(() => {
    tick().catch((e) => logger.warn('Live map simulation first tick failed:', e?.message || e));
  }, 2000);

  logger.info(`Live map simulation: broadcasting dynamic pin updates every ${ms}ms → admin_room`);
}

function stopLiveMapSimulation() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { startLiveMapSimulation, stopLiveMapSimulation, tick };
