import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { playServiceChime } from '../utils/audio';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

// Roles that are NOT tied to a single restaurant's staff. They only ever receive
// events addressed to their own order/user rooms, so no restaurant filter applies.
const NON_TENANT_ROLES = new Set(['', 'CUSTOMER', 'GUEST', 'DRIVER']);

const readAuthToken = () => {
  try {
    return localStorage.getItem('hotel_token') || localStorage.getItem('hms_token');
  } catch {
    return null;
  }
};

const getEventRestaurantId = (data) => {
  if (!data || typeof data !== 'object') return null;
  const rid = data.restaurantId ?? data.restaurant_id ?? data.order?.restaurant_id ?? null;
  return rid === null || rid === undefined || rid === '' ? null : String(rid);
};

export const SocketProvider = ({ children }) => {
  const { user, restaurant } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const socketRef = useRef(null);
  // Rooms this client wants to be in. Server-side membership is lost on every
  // reconnect, so they are re-joined on each 'connect'.
  const roomsRef = useRef(new Set());

  // Who is looking at the screen right now — read by socket handlers at event time.
  const viewerRef = useRef(null);
  viewerRef.current = {
    userId: user?.id ?? null,
    role: String(user?.role || '').toUpperCase(),
    restaurantId: restaurant?.id ?? user?.restaurant_id ?? null
  };

  /**
   * Restaurant staff must only see alerts for THEIR restaurant. Every staff alert
   * carries its restaurant id; anything for another restaurant is ignored.
   */
  const isForCurrentViewer = (data) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.role === 'SUPER_ADMIN') return true;
    if (data?.userId != null && viewer.userId != null && String(data.userId) === String(viewer.userId)) {
      return true; // addressed to this user directly
    }
    if (NON_TENANT_ROLES.has(viewer.role)) return true;

    const eventRestaurantId = getEventRestaurantId(data);
    if (eventRestaurantId === null) return true; // already scoped server-side (user / order room)
    if (viewer.restaurantId === null || viewer.restaurantId === undefined) return false; // cannot verify ownership
    return eventRestaurantId === String(viewer.restaurantId);
  };

  const showToast = (data, durationMs = 5000) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast(data);
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, durationMs);
  };

  useEffect(() => {
    let SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

    if (!SOCKET_URL && typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        SOCKET_URL = 'http://localhost:5000';
      } else {
        SOCKET_URL = window.location.origin;
      }
    }

    const socketInstance = io(SOCKET_URL, {
      transports: ['polling'],
      withCredentials: true,
      // Evaluated on every (re)connect so the handshake always carries the CURRENT login,
      // not whatever was in storage when the page first loaded.
      auth: (cb) => {
        const token = readAuthToken();
        cb(token ? { token } : {});
      },
      reconnectionAttempts: 5,
      timeout: 10000
    });
    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('⚡ Connected to Socket.IO Server');
      setConnected(true);
      roomsRef.current.forEach((room) => socketInstance.emit('join_room', room));
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('notification', (data) => {
      if (!isForCurrentViewer(data)) return;
      showToast(data, 10000);
    });

    socketInstance.on('admin_notification', (data) => {
      if (!isForCurrentViewer(data)) return;
      showToast(data, 10000);
    });

    socketInstance.on('new_order', (data) => {
      if (!isForCurrentViewer(data)) return;
      playServiceChime('new_order');
      showToast({
        title: `🛒 New Order #${data.order_number || data.orderId || ''}!`,
        message: `New order received from ${data.customer_name || 'Customer'}. Click to view live pipeline.`,
        link: '/admin/offline/orders',
        type: 'NEW_ORDER'
      }, 10000);
    });

    socketInstance.on('bill_requested', (data) => {
      if (!isForCurrentViewer(data)) return;
      showToast({
        title: `🧾 Bill Requested: Table ${data.table_number || 'Dine-In'}`,
        message: `Guests at Table ${data.table_number || ''} requested their bill. Click to view POS.`,
        link: '/admin/offline/billing',
        type: 'BILL_REQUEST'
      }, 10000);
    });

    socketInstance.on('call_waiter', (data) => {
      if (!isForCurrentViewer(data)) return;
      showToast({
        title: `🛎️ Waiter Called: Table ${data.table_number || 'T01'}!`,
        message: `Guests at Table ${data.table_number || ''} (${data.floor || 'Dining Area'}) called for waiter assistance. Click to open.`,
        link: '/waiter',
        type: 'CALL_WAITER'
      }, 10000);
    });

    socketInstance.on('order_status_updated', (data) => {
      if (!isForCurrentViewer(data)) return;
      showToast({
        title: `🔔 Order Status Updated`,
        message: `Order #${data.orderNumber || data.orderId || ''} updated to ${data.status || 'new status'}.`,
        link: '/hotel/admin/orders',
        type: 'ORDER_STATUS'
      }, 10000);
    });

    setSocket(socketInstance);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      socketInstance.disconnect();
      if (socketRef.current === socketInstance) socketRef.current = null;
    };
  }, []);

  // Login / logout / account switch: re-handshake so the server sees the new identity
  // (and authorizes restaurant rooms for it). Rooms are re-joined on 'connect'.
  const authUserId = user?.id ?? null;
  const lastAuthUserIdRef = useRef(authUserId);
  useEffect(() => {
    if (lastAuthUserIdRef.current === authUserId) return;
    lastAuthUserIdRef.current = authUserId;
    setToast(null);
    const s = socketRef.current;
    if (s) {
      s.disconnect();
      s.connect();
    }
  }, [authUserId]);

  const joinRoom = useCallback((roomName) => {
    if (!roomName) return;
    roomsRef.current.add(roomName);
    const s = socketRef.current;
    if (s?.connected) s.emit('join_room', roomName);
  }, []);

  const leaveRoom = useCallback((roomName) => {
    if (!roomName) return;
    roomsRef.current.delete(roomName);
    const s = socketRef.current;
    if (s?.connected) s.emit('leave_room', roomName);
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, toast, setToast, joinRoom, leaveRoom }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
