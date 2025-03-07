// SearchMusic.js - Updated with enhanced mobile back button
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Music, User } from 'lucide-react';
import RequestNotificationModal from './RequestNotificationModal';
import '../styles/SearchMusic.css';

function SearchMusic() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchType, setSearchType] = useState('artist');
  const [isHost, setIsHost] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationType, setNotificationType] = useState('info');
  const [isMobile, setIsMobile] = useState(false);
  
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
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [isHostParam]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      // const response = await fetch(`http://127.0.0.1:5000/api/search-music?query=${encodeURIComponent(searchQuery)}&search_type=${searchType}`);
      const response = await fetch(`http://13.56.253.58:5000/api/search-music?query=${encodeURIComponent(searchQuery)}&search_type=${searchType}`);
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

  const handleAddToPlaylist = async (track) => {
    try {
      // Different endpoints for host vs. non-host
      const endpoint = isHost ? 'add-to-playlist' : 'request-track';
      
      const response = await fetch(`http://127.0.0.1:5000/api/${endpoint}`, {
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
              placeholder={`Search by ${searchType}`}
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
    </div>
  );
}

export default SearchMusic;