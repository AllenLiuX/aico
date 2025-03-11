// usePlaylist.js
import { useState, useEffect } from 'react';

/**
 * Custom hook to manage playlist data and pending requests
 */
const usePlaylist = (roomName, isHost) => {
  const [playlist, setPlaylist] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [introduction, setIntroduction] = useState('');
  const [settings, setSettings] = useState({});
  const [hostData, setHostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial room data
  useEffect(() => {
    if (!roomName) return;

    const fetchRoomData = async () => {
      try {
        setLoading(true);
        console.log(`Fetching room data for ${roomName}`);
        
        // Fetch main playlist data
        const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch playlist (${response.status})`);
        }
        
        const data = await response.json();
        console.log(`Received room data: playlist: ${data.playlist?.length || 0} songs`);
        
        setPlaylist(data.playlist || []);
        setIntroduction(data.introduction || '');
        setSettings(data.settings || {});
        setHostData(data.host || null);
        
        // If user is host, also fetch pending requests
        if (isHost) {
          console.log(`User is host, fetching pending requests for ${roomName}`);
          await fetchPendingRequests();
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching room data:', error);
        setError(`Failed to load playlist: ${error.message}`);
        setLoading(false);
      }
    };

    fetchRoomData();
  }, [roomName, isHost]);

  // Function to fetch pending requests
  const fetchPendingRequests = async () => {
    if (!roomName) return;
    
    // Log the fetch attempt with host status
    console.log(`Fetching pending requests for room ${roomName}, isHost=${isHost}`);
    
    try {
      const token = localStorage.getItem('token') || '';
      console.log(`Request with token: ${token ? 'Token present' : 'No token'}`);
      
      const response = await fetch(`http://13.56.253.58:5000/api/pending-requests?room_name=${roomName}`, {
        headers: {
          'Authorization': token,
          'Cache-Control': 'no-cache' // Prevent caching
        }
      });
      
      console.log(`Pending requests response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Received pending requests: ${data.requests ? data.requests.length : 0}`);
        
        // Always update the state with the latest data, removing the conditional
        setPendingRequests(data.requests || []);
        
        if (data.requests && data.requests.length > 0) {
          console.log('Pending requests details:', data.requests);
        }
      } else {
        // Log the error response
        const errorText = await response.text();
        console.error(`Error fetching pending requests: ${response.status}`, errorText);
      }
    } catch (err) {
      console.error('Exception fetching pending requests:', err);
    }
  };

  // Function to handle track deletion
  const handleTrackDelete = (newPlaylist) => {
    setPlaylist(newPlaylist);
  };

  // Function to approve a request
  const handleApproveRequest = (data) => {
    // Update the main playlist with the newly approved track
    setPlaylist(prev => [...prev, data.approved_track]);
    
    // Remove the track from pending requests
    setPendingRequests(prev => 
      prev.filter(track => track.request_id !== data.request_id)
    );
    
    console.log(`Approved request ${data.request_id}, added to playlist`);
    
    // Fetch pending requests again to sync
    setTimeout(() => {
      fetchPendingRequests();
    }, 10000);
  };
  
  // Function to reject a request
  const handleRejectRequest = (data) => {
    // Remove the track from pending requests
    setPendingRequests(prev => 
      prev.filter(track => track.request_id !== data.request_id)
    );
    
    console.log(`Rejected request ${data.request_id}`);
    
    // Fetch pending requests again to sync
    setTimeout(() => {
      fetchPendingRequests();
    }, 10000);
  };

  // Function to update room moderation settings
  const updateRoomModeration = async (roomName, moderationEnabled) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://13.56.253.58:5000/api/room/update-moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || ''
        },
        body: JSON.stringify({
          room_name: roomName,
          moderation_enabled: moderationEnabled
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update moderation settings');
      }

      const data = await response.json();
      console.log(`Updated moderation settings: ${moderationEnabled}`);
      
      // Update local settings state
      setSettings(prev => ({
        ...prev,
        moderation_enabled: moderationEnabled
      }));
      
      return data;
    } catch (error) {
      console.error('Error updating moderation settings:', error);
      throw error;
    }
  };

  // Function to update playlist info (introduction)
  const updatePlaylistInfo = async (roomName, newIntroduction) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://13.56.253.58:5000/api/update-playlist-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || ''
        },
        body: JSON.stringify({
          room_name: roomName,
          introduction: newIntroduction
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update playlist information');
      }

      // Update local state
      setIntroduction(newIntroduction);
      console.log(`Updated playlist introduction for ${roomName}`);
      
      return await response.json();
    } catch (error) {
      console.error('Error updating playlist information:', error);
      throw error;
    }
  };


  // Return values and functions from the hook
  return {
    playlist,
    setPlaylist,
    pendingRequests,
    fetchPendingRequests,
    introduction,
    settings,
    hostData,
    loading,
    error,
    handleTrackDelete,
    handleApproveRequest,
    handleRejectRequest,
    updateRoomModeration,
    updatePlaylistInfo
  };
};

export default usePlaylist;