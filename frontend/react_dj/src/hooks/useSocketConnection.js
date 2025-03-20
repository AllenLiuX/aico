// frontend/react_dj/src/hooks/useSocketConnection.js
import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config';

const useSocketConnection = (roomName, isHost = false) => {
  const [socket, setSocket] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initial connection
  useEffect(() => {
    if (!roomName) return;

    // Get user data
    const userDataStr = localStorage.getItem('user');
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const username = userData ? userData.username : 'Guest';

    try {
      // Connect to the socket server
      const socketInstance = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Set up event listeners
      socketInstance.on('connect', () => {
        console.log('Socket connected successfully');
        setIsConnected(true);
        setConnectionError(null);
        
        // Join the room
        socketInstance.emit('join_room', {
          room_name: roomName,
          is_host: isHost,
          username: username
        });
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnectionError('Failed to connect to room server');
        setIsConnected(false);
      });

      socketInstance.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      socketInstance.on('user_joined', (data) => {
        console.log('User joined:', data);
        setConnectedUsers(prev => [...prev, data]);
      });

      socketInstance.on('user_left', (data) => {
        console.log('User left:', data);
        setConnectedUsers(prev => 
          prev.filter(user => user.username !== data.username)
        );
      });

      setSocket(socketInstance);

      // Cleanup
      return () => {
        if (socketInstance) {
          socketInstance.emit('leave_room', {
            room_name: roomName,
            username: username
          });
          socketInstance.disconnect();
        }
      };
    } catch (error) {
      console.error('Socket initialization error:', error);
      setConnectionError('Failed to initialize room connection');
    }
  }, [roomName, isHost]);

  // Emit player state update (host only)
  const emitPlayerState = useCallback((playerState) => {
    if (!socket || !isHost || !isConnected) return;

    // Get username from localStorage - ensure it's not 'guest' if the user is logged in
    let username = localStorage.getItem('username') || 'guest';
    const token = localStorage.getItem('token');
    
    // If there's a token but username is guest, try to get the actual username
    if (token && (username === 'guest' || username === 'Guest')) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userObj = JSON.parse(storedUser);
          if (userObj && userObj.username) {
            username = userObj.username;
          }
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
    }
    
    console.log('Emitting player state change:', {
      room_name: roomName,
      is_host: true,
      player_state: playerState,
      username: username
    });

    socket.emit('player_state_change', {
      room_name: roomName,
      is_host: true,
      player_state: playerState,
      username: username
    });
  }, [socket, roomName, isHost, isConnected]);

  return {
    socket,
    connectedUsers,
    connectionError,
    isConnected,
    emitPlayerState
  };
};

export default useSocketConnection;