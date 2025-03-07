// useNotifications.js
import { useState, useEffect } from 'react';

/**
 * Custom hook to manage notifications and request status updates
 */
const useNotifications = (roomName, isHost) => {
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationType, setNotificationType] = useState('info');
  
  // Set up polling for notifications
  useEffect(() => {
    if (!roomName) return;
    
    // Only non-hosts need to poll for request status updates
    if (isHost) return;
    
    const checkInterval = setInterval(() => {
      checkRequestStatus();
    }, 10000); // Poll every 10 seconds
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [roomName, isHost]);

  // Function to check request status
  const checkRequestStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return; // Only logged in users can have requests
    
    try {
      // const response = await fetch(`http://127.0.0.1:5000/api/request-status?room_name=${roomName}`, {
      const response = await fetch(`http://13.56.253.58:5000/api/request-status?room_name=${roomName}`, {
        headers: {
          'Authorization': token
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // If there are new notifications
        if (data.notifications && data.notifications.length > 0) {
          // Show the most recent notification
          const latestNotification = data.notifications[0];
          setNotificationTitle(latestNotification.status === 'approved' ? 'Request Approved' : 'Request Declined');
          setNotificationMessage(latestNotification.message);
          setNotificationType(latestNotification.status === 'approved' ? 'success' : 'error');
          setShowNotification(true);
        }
      }
    } catch (err) {
      console.error('Error checking request status:', err);
    }
  };

  // Function to show a notification
  const showNotificationMessage = (title, message, type = 'info') => {
    setNotificationTitle(title);
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
  };

  return {
    showNotification,
    setShowNotification,
    notificationMessage,
    notificationTitle,
    notificationType,
    showNotificationMessage,
    checkRequestStatus
  };
};

export default useNotifications;