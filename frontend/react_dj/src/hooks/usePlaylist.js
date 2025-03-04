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
        // Fetch main playlist data
        const response = await fetch(`http://127.0.0.1:5000/api/room-playlist?room_name=${roomName}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch playlist (${response.status})`);
        }
        
        const data = await response.json();
        setPlaylist(data.playlist || []);
        setIntroduction(data.introduction || '');
        setSettings(data.settings || {});
        setHostData(data.host || null);
        
        // If user is host, also fetch pending requests
        if (isHost) {
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
    if (!isHost || !roomName) return;
    
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/pending-requests?room_name=${roomName}`, {
        headers: {
          'Authorization': localStorage.getItem('token') || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Only update if count has changed to avoid unnecessary re-renders
        if (!pendingRequests.length || data.requests.length !== pendingRequests.length) {
          setPendingRequests(data.requests || []);
        }
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err);
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
  };
  
  // Function to reject a request
  const handleRejectRequest = (data) => {
    // Remove the track from pending requests
    setPendingRequests(prev => 
      prev.filter(track => track.request_id !== data.request_id)
    );
  };

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
    handleRejectRequest
  };
};

export default usePlaylist;