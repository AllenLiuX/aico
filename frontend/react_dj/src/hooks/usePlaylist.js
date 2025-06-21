// usePlaylist.js
import { useState, useEffect, useRef, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { API_URL } from '../config';

/**
 * Custom hook to manage playlist data and room interactions
 * @param {string} roomName - The name of the current room
 * @param {boolean} isHost - Whether the current user is the host of the room
 */
const usePlaylist = (roomName, isHost) => {
  // State for playlist and related data
  const [playlist, setPlaylist] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [introduction, setIntroduction] = useState('');
  const [settings, setSettings] = useState({});
  const [hostData, setHostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refs for managing polling and request state
  const pollIntervalRef = useRef(null);
  const isPollingRef = useRef(false);
  const mountedRef = useRef(true);
  const pollAttemptsRef = useRef(0);

  // Debounced fetch function to prevent rapid repeated calls
  const fetchPendingRequests = useCallback(
    debounce(async () => {
      // Exit early if not the host or component is unmounted
      if (!isHost || !mountedRef.current || isPollingRef.current) return;

      try {
        isPollingRef.current = true;
        
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${API_URL}/api/pending-requests?room_name=${roomName}`, 
          {
            headers: {
              'Authorization': token || ''
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch pending requests');
        }

        const data = await response.json();
        
        // Only update if requests have changed
        setPendingRequests(prevRequests => {
          const requestsChanged = JSON.stringify(prevRequests) !== JSON.stringify(data.requests);
          return requestsChanged ? data.requests : prevRequests;
        });

        // Reset poll attempts on successful fetch
        pollAttemptsRef.current = 0;
      } catch (err) {
        console.error('Error fetching pending requests:', err);
        
        // Implement exponential backoff
        pollAttemptsRef.current = Math.min(pollAttemptsRef.current + 1, 5);
      } finally {
        isPollingRef.current = false;
      }
    }, 500), // 500ms debounce
    [roomName, isHost]
  );

  // Fetch initial room data
  useEffect(() => {
    // Reset state when room changes
    setLoading(true);
    setError(null);
    mountedRef.current = true;

    if (!roomName) return;

    const fetchRoomData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/room-playlist?room_name=${roomName}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch playlist (${response.status})`);
        }
        
        const data = await response.json();
        
        if (mountedRef.current) {
          setPlaylist(data.playlist || []);
          setIntroduction(data.introduction || '');
          setSettings(data.settings || {});
          setHostData(data.host || null);
          
          // If host, start polling for pending requests
          if (isHost) {
            startPolling();
          }
        }
      } catch (error) {
        console.error('Error fetching room data:', error);
        if (mountedRef.current) {
          setError(`Failed to load playlist: ${error.message}`);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Start polling method with exponential backoff
    const startPolling = () => {
      // Clear any existing intervals
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      // Calculate interval with exponential backoff (max 60 seconds)
      const calculateInterval = () => {
        const baseInterval = 10000; // 10 seconds
        const attempts = pollAttemptsRef.current;
        return Math.min(baseInterval * Math.pow(2, attempts), 60000);
      };

      // Set up interval
      pollIntervalRef.current = setInterval(() => {
        fetchPendingRequests();
      }, calculateInterval());
    };

    fetchRoomData();

    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [roomName, isHost, fetchPendingRequests]);

  // Track deletion handler
  const handleTrackDelete = (newPlaylist) => {
    setPlaylist(newPlaylist);
  };

  // Approve request handler
  const handleApproveRequest = (data) => {
    // Update the main playlist with the newly approved track
    setPlaylist(prev => [...prev, data.approved_track]);
    
    // Remove the track from pending requests
    setPendingRequests(prev => 
      prev.filter(track => track.request_id !== data.request_id)
    );
  };
  
  // Reject request handler
  const handleRejectRequest = (data) => {
    // Remove the track from pending requests
    setPendingRequests(prev => 
      prev.filter(track => track.request_id !== data.request_id)
    );
  };

  // Room moderation update method
  const updateRoomModeration = async (roomName, moderationEnabled) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/room/update-moderation`, {
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
      
      // Update local settings
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

  // Playlist info update method
  const updatePlaylistInfo = async (roomName, newIntroduction) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/update-playlist-info`, {
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

      // Update local introduction state
      setIntroduction(newIntroduction);
      
      return await response.json();
    } catch (error) {
      console.error('Error updating playlist information:', error);
      throw error;
    }
  };

  // Handle pin to top action
  const handlePinToTop = async (actualIndex, currentPlayingIndex, isGuestPin = false) => {
    try {
      const trackToPin = playlist[actualIndex];
      
      // Make API call to pin track
      const response = await fetch(`${API_URL}/api/pin-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') // Add token for guest authentication
        },
        body: JSON.stringify({
          room_name: roomName,
          track_id: trackToPin.song_id,
          current_playing_index: currentPlayingIndex,
          selected_index: actualIndex,
          is_guest_pin: isGuestPin // Flag to indicate if this is a guest pin
        })
      });

      if (!response.ok) {
        throw new Error('Failed to pin track');
      }

      const data = await response.json();
      return data.playlist;
      
    } catch (error) {
      console.error('Error pinning track:', error);
      return null;
    }
  };

  // AI moderation settings fetch method
  const fetchAiModerationSettings = async (roomName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/room/get-ai-moderation?room_name=${roomName}`, {
        headers: {
          'Authorization': token || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI moderation settings');
      }

      const data = await response.json();
      return data.settings;
    } catch (error) {
      console.error('Error fetching AI moderation settings:', error);
      throw error;
    }
  };

  // AI moderation settings update method
  const updateAiModerationSettings = async (roomName, enabled, description, strictnessLevel) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/room/update-ai-moderation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || ''
        },
        body: JSON.stringify({
          room_name: roomName,
          enabled: enabled,
          description: description,
          strictness_level: strictnessLevel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update AI moderation settings');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating AI moderation settings:', error);
      throw error;
    }
  };

  // Fetch AI moderation hints method
  const fetchAiModerationHints = async (roomName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/room/ai-moderation-hints?room_name=${roomName}`, {
        headers: {
          'Authorization': token || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI moderation hints');
      }

      const data = await response.json();
      return data.hints;
    } catch (error) {
      console.error('Error fetching AI moderation hints:', error);
      throw error;
    }
  };

  // Fetch AI moderation history method
  const fetchAiModerationHistory = async (roomName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/room/ai-moderation-history?room_name=${roomName}`, {
        headers: {
          'Authorization': token || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI moderation history');
      }

      const data = await response.json();
      return data.history;
    } catch (error) {
      console.error('Error fetching AI moderation history:', error);
      throw error;
    }
  };

  // Return all necessary methods and states
  return {
    playlist,
    setPlaylist,
    pendingRequests,
    setPendingRequests,
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
    updatePlaylistInfo,
    handlePinToTop,
    // New AI moderation methods
    fetchAiModerationSettings,
    updateAiModerationSettings,
    fetchAiModerationHints,
    fetchAiModerationHistory
  };
};

export default usePlaylist;