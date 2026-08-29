import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { playServiceChime } from '../utils/audio';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [toast, setToast] = useState(null);
  const timerRef = React.useRef(null);

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
        SOCKET_URL = 'https://jattamkommerce.com';
      }
    }

    const token = localStorage.getItem('hotel_token') || localStorage.getItem('hms_token');

    const socketInstance = io(SOCKET_URL, {
      transports: ['polling'],
      withCredentials: true,
      auth: token ? { token } : undefined,
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Connected to Socket.IO Server');
    });

    socketInstance.on('notification', (data) => {
      showToast(data, 10000);
    });

    socketInstance.on('admin_notification', (data) => {
      playServiceChime('new_order');
      showToast(data, 10000);
    });

    socketInstance.on('new_order', (data) => {
      playServiceChime('new_order');
      showToast({
        title: `🛒 New Order #${data.order_number || data.orderId || ''}!`,
        message: `New order received from ${data.customer_name || 'Customer'}. Click to view live pipeline.`,
        link: '/admin/offline/orders',
        type: 'NEW_ORDER'
      }, 10000);
    });

    socketInstance.on('bill_requested', (data) => {
      showToast({
        title: `🧾 Bill Requested: Table ${data.table_number || 'Dine-In'}`,
        message: `Guests at Table ${data.table_number || ''} requested their bill. Click to view POS.`,
        link: '/admin/offline/billing',
        type: 'BILL_REQUEST'
      }, 10000);
    });

    socketInstance.on('call_waiter', (data) => {
      showToast({
        title: `🛎️ Waiter Called: Table ${data.table_number || 'T01'}!`,
        message: `Guests at Table ${data.table_number || ''} (${data.floor || 'Dining Area'}) called for waiter assistance. Click to open.`,
        link: '/waiter',
        type: 'CALL_WAITER'
      }, 10000);
    });

    socketInstance.on('order_status_updated', (data) => {
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
    };
  }, []);

  const joinRoom = (roomName) => {
    if (socket) {
      socket.emit('join_room', roomName);
    }
  };

  const leaveRoom = (roomName) => {
    if (socket) {
      socket.emit('leave_room', roomName);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, connected: Boolean(socket?.connected), toast, setToast, joinRoom, leaveRoom }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
