/**
 * Store the Socket.io server instance so controllers can emit events
 * (e.g. status_change, staff_moved) without circular dependencies.
 */
let io = null;

function setIO(serverInstance) {
  io = serverInstance;
}

function getIO() {
  return io;
}

module.exports = { setIO, getIO };
