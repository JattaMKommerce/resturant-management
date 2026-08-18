let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
}

function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized!');
  }
  return ioInstance;
}

function emitToRoom(room, event, payload) {
  if (ioInstance) {
    ioInstance.to(room).emit(event, payload);
  }
}

function broadcastEvent(event, payload) {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
}

module.exports = {
  setSocketIO,
  getIO,
  emitToRoom,
  broadcastEvent
};
