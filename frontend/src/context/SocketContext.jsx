import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
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
      setTimeout(() => setToast(null), 5000);
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
