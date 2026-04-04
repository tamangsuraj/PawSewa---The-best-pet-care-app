/** In-memory socket presence counts (userId -> concurrent connections). */
const counts = new Map();

function presenceConnect(userId) {
  if (!userId) return;
  const id = String(userId);
  counts.set(id, (counts.get(id) || 0) + 1);
}

function presenceDisconnect(userId) {
  if (!userId) return;
  const id = String(userId);
  const n = (counts.get(id) || 1) - 1;
  if (n <= 0) counts.delete(id);
  else counts.set(id, n);
}

function isUserOnline(userId) {
  return (counts.get(String(userId)) || 0) > 0;
}

function batchOnline(userIds) {
  const out = {};
  if (!Array.isArray(userIds)) return out;
  for (const id of userIds) {
    out[String(id)] = isUserOnline(id);
  }
  return out;
}

module.exports = {
  presenceConnect,
  presenceDisconnect,
  isUserOnline,
  batchOnline,
};
