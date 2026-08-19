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

/**
 * Emit event to a specific room
 */
function emitToRoom(room, event, payload) {
  if (ioInstance) {
    ioInstance.to(room).emit(event, payload);
  }
}

/**
 * Broadcast event to all connected sockets
 */
function broadcastEvent(event, payload) {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
}

/**
 * Tenant-scoped room emitter.
 * Emits to isolated tenant room and maintains backward compatibility with legacy room names.
 *
 * @param {number|string} restaurantId - Restaurant ID
 * @param {'admin'|'waiter'|'kitchen'|'cashier'} department - Target department
 * @param {string} event - Event name
 * @param {*} payload - Data payload
 */
function emitToTenant(restaurantId, department, event, payload) {
  if (!ioInstance) return;

  const tenantRoom = `restaurant_${restaurantId}_${department}`;
  ioInstance.to(tenantRoom).emit(event, payload);

  // Backward compatibility legacy room mappings
  if (department === 'admin') {
    ioInstance.to(`restaurant_admin_${restaurantId}`).emit(event, payload);
  } else if (department === 'waiter') {
    ioInstance.to('waiter').emit(event, payload);
    ioInstance.to(`restaurant_admin_${restaurantId}`).emit(event, payload);
  } else if (department === 'kitchen') {
    ioInstance.to('kitchen').emit(event, payload);
    ioInstance.to(`restaurant_admin_${restaurantId}`).emit(event, payload);
  }
}

/**
 * Emit event to customer / order tracking room
 */
function emitToOrder(orderId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`order_${orderId}`).emit(event, payload);
  ioInstance.to(`customer_${orderId}`).emit(event, payload);
}

/**
 * Emit event to driver private room
 */
function emitToDriver(driverId, restaurantId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`driver_${driverId}`).emit(event, payload);
  if (restaurantId) {
    ioInstance.to(`restaurant_${restaurantId}_driver_${driverId}`).emit(event, payload);
  }
}

module.exports = {
  setSocketIO,
  getIO,
  emitToRoom,
  broadcastEvent,
  emitToTenant,
  emitToOrder,
  emitToDriver
};
