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

// User Presence Tracking
const connectedUsers = new Map(); // userId -> Set(socketIds)

function trackUserConnection(socket, user) {
  if (!user || !user.id) return;
  const userId = parseInt(user.id, 10);
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socket.id);

  if (user.restaurant_id) {
    emitToTenant(user.restaurant_id, 'admin', 'staff_presence_change', {
      userId,
      isOnline: true,
      role: user.role
    });
  }
}

function trackUserDisconnection(socket, user) {
  if (!user || !user.id) return;
  const userId = parseInt(user.id, 10);
  if (connectedUsers.has(userId)) {
    const sockets = connectedUsers.get(userId);
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      connectedUsers.delete(userId);
      if (user.restaurant_id) {
        emitToTenant(user.restaurant_id, 'admin', 'staff_presence_change', {
          userId,
          isOnline: false,
          role: user.role
        });
      }
    }
  }
}

function isUserOnline(userId) {
  if (!userId) return false;
  const id = parseInt(userId, 10);
  return connectedUsers.has(id) && connectedUsers.get(id).size > 0;
}

module.exports = {
  setSocketIO,
  getIO,
  emitToRoom,
  broadcastEvent,
  emitToTenant,
  emitToOrder,
  emitToDriver,
  trackUserConnection,
  trackUserDisconnection,
  isUserOnline
};
