import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const defaultSocketUrl = `${protocol}//${host}:5000`;
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultSocketUrl;

    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Connected to Socket.IO Server');
    });

    socketInstance.on('notification', (data) => {
      setToast(data);
      setTimeout(() => setToast(null), 5000);
    });

    socketInstance.on('admin_notification', (data) => {
      setToast(data);
      setTimeout(() => setToast(null), 6000);
    });

    socketInstance.on('bill_requested', (data) => {
      setToast({
        title: `🧾 Bill Requested: Table ${data.table_number || 'Dine-In'}`,
        message: `Guests at Table ${data.table_number || ''} (${data.floor || 'Floor'}) requested their bill.`,
        link: '/admin/offline/billing'
      });
      setTimeout(() => setToast(null), 8000);
    });

    setSocket(socketInstance);

    return () => {
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
