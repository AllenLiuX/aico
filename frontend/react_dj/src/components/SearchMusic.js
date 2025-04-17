// SearchMusic.js - Updated with confirmation modal
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Music, User, Lightbulb } from 'lucide-react';
import RequestNotificationModal from './RequestNotificationModal';
import RequestConfirmModal from './RequestConfirmModal'; // Import the new component
import { API_URL } from '../config';
import '../styles/SearchMusic.css';

function SearchMusic() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchType, setSearchType] = useState('song');
  const [isHost, setIsHost] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationType, setNotificationType] = useState('info');
  const [isMobile, setIsMobile] = useState(false);
  
  // New state for confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [trackToRequest, setTrackToRequest] = useState(null);
  const [currentTrackPlaying, setCurrentTrackPlaying] = useState(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room');
  const isHostParam = queryParams.get('is_host');

  useEffect(() => {
    // Check if user is host
    setIsHost(isHostParam === 'True');
    
    // Check if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Fetch current playing track when component mounts
    fetchCurrentPlayingTrack();
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [isHostParam]);

  // Function to fetch current playing track
  const fetchCurrentPlayingTrack = async () => {
    if (!roomName) return;
    
    try {
      const response = await fetch(`${API_URL}/api/room-playlist?room_name=${roomName}`);
      if (response.ok) {
        const data = await response.json();
        // Find the current playing track if there's a socket state
        const playerStateResponse = await fetch(`${API_URL}/api/room/player-state?room_name=${roomName}`);
        
        if (playerStateResponse.ok) {
          const playerState = await playerStateResponse.json();
          if (playerState && playerState.currentTrack !== undefined && data.playlist) {
            setCurrentTrackPlaying(data.playlist[playerState.currentTrack] || null);
          } else if (data.playlist && data.playlist.length > 0) {
            // Fallback to first track if no player state
            setCurrentTrackPlaying(data.playlist[0]);
          }
        } else if (data.playlist && data.playlist.length > 0) {
          // Fallback to first track if no player state endpoint
          setCurrentTrackPlaying(data.playlist[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching current track:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      const response = await fetch(`${API_URL}/api/search-music?query=${encodeURIComponent(searchQuery)}&search_type=${searchType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }
      const data = await response.json();
      setSearchResults(data.tracks || []);
    } catch (err) {
      setError('An error occurred while searching for music. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Modified to show confirmation modal first for non-hosts
  const handleAddToPlaylist = (track) => {
    if (isHost) {
      // Host can add directly without confirmation
      addTrackToPlaylist(track);
    } else {
      // For non-hosts, show confirmation modal first
      setTrackToRequest(track);
      setShowConfirmModal(true);
    }
  };

  // Actual function to add track to playlist or request it
  const addTrackToPlaylist = async (track) => {
    try {
      // Different endpoints for host vs. non-host
      const endpoint = isHost ? 'add-to-playlist' : 'request-track';
      
      const response = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') || '' // Send user token if available
        },
        body: JSON.stringify({
          room_name: roomName,
          track: track,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isHost ? 'add' : 'request'} track`);
      }

      // Show different notification based on user role
      if (isHost) {
        setNotificationTitle('Track Added');
        setNotificationMessage('Track added to playlist successfully!');
        setNotificationType('success');
      } else {
        setNotificationTitle('Track Requested');
        setNotificationMessage('Your song has been requested and is waiting for host approval.');
        setNotificationType('pending');
      }
      
      setShowNotification(true);
    } catch (err) {
      setNotificationTitle('Error');
      setNotificationMessage(`Failed to ${isHost ? 'add' : 'request'} track. Please try again.`);
      setNotificationType('error');
      setShowNotification(true);
      console.error('Add/request track error:', err);
    }
  };

  // Handler for confirmation modal's confirm button
  const handleConfirmRequest = () => {
    setShowConfirmModal(false);
    if (trackToRequest) {
      addTrackToPlaylist(trackToRequest);
    }
  };

  const navigateToRoom = () => {
    navigate(`/playroom?room_name=${roomName}&is_host=${isHostParam}`);
  };

  return (
    <div className="search-music">
      <button
        onClick={navigateToRoom}
        className="back-button"
        aria-label="Back to Room"
      >
        <ArrowLeft size={isMobile ? 16 : 18} />
        {!isMobile && "Back to Room"}
        {isMobile && "Back"}
      </button>

      <div className="search-header">
        <h1>Search Music</h1>
      </div>

      <div className="search-form-container">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by ${searchType === 'artist' ? 'artist' : searchType === 'song' ? 'song' : 'prompt'}`}
              className="search-input"
            />
          </div>
          <button 
            type="submit" 
            className="search-button" 
            disabled={isLoading || !searchQuery.trim()}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="search-toggle">
          <button
            className={`toggle-option ${searchType === 'artist' ? 'active' : ''}`}
            onClick={() => setSearchType('artist')}
          >
            <User size={18} />
            Artist
          </button>
          <button
            className={`toggle-option ${searchType === 'song' ? 'active' : ''}`}
            onClick={() => setSearchType('song')}
          >
            <Music size={18} />
            Song
          </button>
          <button
            className={`toggle-option ${searchType === 'prompt' ? 'active' : ''}`}
            onClick={() => setSearchType('prompt')}
          >
            <Lightbulb size={18} />
            Prompt
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isLoading ? (
        <div className="loading-state">Searching for music...</div>
      ) : searchResults.length > 0 ? (
        <div className="search-results">
          {searchResults.map((track) => (
            <div key={track.song_id} className="track-card">
              <img 
                src={track.cover_img_url} 
                alt={track.title}
                className="track-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/api/placeholder/300/300';
                }}
              />
              <div className="track-content">
                <h3 className="track-title">{track.title}</h3>
                <p className="track-artist">{track.artist}</p>
                <div className="track-actions">
                  <a
                    href={track.song_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-button listen-button"
                  >
                    Listen
                  </a>
                  <button
                    onClick={() => handleAddToPlaylist(track)}
                    className="action-button add-button"
                  >
                    <Plus size={16} />
                    {isHost ? 'Add' : 'Request'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : searchQuery && !isLoading ? (
        <div className="loading-state">No results found</div>
      ) : null}
      
      {/* Notification Modal */}
      <RequestNotificationModal 
        isOpen={showNotification}
        onClose={() => setShowNotification(false)}
        title={notificationTitle}
        message={notificationMessage}
        type={notificationType}
      />
      
      {/* Request Confirmation Modal */}
      <RequestConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmRequest}
        requestedTrack={trackToRequest || {}}
        currentTrack={currentTrackPlaying}
      />
    </div>
  );
}

export default SearchMusic;