import React, { useState, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';
import { Trash2, ArrowUp, Heart, X } from 'lucide-react';
import { API_URL } from '../config';
import '../styles/PlaylistTrack.css';
import { UserContext } from '../contexts/UserContext';

const PlaylistTrack = ({ 
  track = {},
  index = 0,
  isHost = false,
  isCurrentTrack = false,
  currentPlayingIndex = 0,
  roomName = '',
  onTrackClick = () => {},
  onTrackDelete = () => {},
  onPinToTop = () => {},
  stopProgressTracking = () => {}
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [error, setError] = useState(null);
  const [showPinConfirmation, setShowPinConfirmation] = useState(false);
  const [pinPrice, setPinPrice] = useState(10); // Default pin price is 10 coins
  
  const { user, token } = useContext(UserContext);

  // Fetch pin price when component mounts
  useEffect(() => {
    const fetchPinPrice = async () => {
      if (!roomName) return;
      
      try {
        const response = await fetch(`${API_URL}/api/coins/get-pin-price?room_name=${roomName}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch pin price');
        }
        
        const data = await response.json();
        setPinPrice(data.price);
      } catch (err) {
        console.error('Error fetching pin price:', err);
        // Keep default price if fetch fails
      }
    };
    
    fetchPinPrice();
  }, [roomName]);

  // Check if song is already favorited when component mounts
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!track.song_id) return;
      
      const token = localStorage.getItem('token');
      if (!token) return;
      
      try {
        const response = await fetch(`${API_URL}/api/check-favorite-song`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          },
          body: JSON.stringify({
            song_id: track.song_id
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to check favorite status');
        }
        
        const data = await response.json();
        setIsFavorited(data.is_favorited);
      } catch (err) {
        console.error('Error checking favorite status:', err);
      }
    };
    
    checkFavoriteStatus();
  }, [track.song_id]);

  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent triggering track click
    
    if (!isHost || isDeleting || !track.song_id) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      
      // Only stop progress tracking if this is the current track
      // This ensures we don't interrupt tracking when deleting other tracks
      if (isCurrentTrack) {
        stopProgressTracking();
      }
      const response = await fetch(`${API_URL}/api/remove-from-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          track_id: track.song_id
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to delete track');
      }
  
      const data = await response.json();
      onTrackDelete(data.playlist);
      
    } catch (err) {
      setError('Failed to delete track');
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePinToTop = async (e) => {
    e.stopPropagation(); // Prevent triggering track click
    
    // If user is host, pin directly without confirmation
    if (isHost) {
      try {
        setIsPinning(true);
        setError(null);
        
        // Call the parent function to get the actual index
        onPinToTop(index, currentPlayingIndex);
        
      } catch (err) {
        setError('Failed to pin track');
        console.error('Pin error:', err);
      } finally {
        setIsPinning(false);
      }
      return;
    }
    
    // For guests, show confirmation dialog
    if (!user) {
      setError('Please log in to pin tracks');
      return;
    }
    
    if (isPinning) return;
    
    // Show confirmation dialog
    setShowPinConfirmation(true);
  };
  
  const confirmPinToTop = async () => {
    try {
      setIsPinning(true);
      setError(null);
      
      // Call the parent function to get the actual index
      // The backend will handle coin deduction and host rewards
      onPinToTop(index, currentPlayingIndex, true); // Pass true to indicate guest pin
      
    } catch (err) {
      setError('Failed to pin track');
      console.error('Pin error:', err);
    } finally {
      setIsPinning(false);
      setShowPinConfirmation(false);
    }
  };
  
  const cancelPinToTop = () => {
    setShowPinConfirmation(false);
  };

  const handleFavorite = async (e) => {
    e.stopPropagation(); // Prevent triggering track click
    
    if (isFavoriting || !track.song_id) return;
    
    try {
      setIsFavoriting(true);
      setError(null);
      
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Please log in to favorite songs');
        return;
      }
      
      const response = await fetch(`${API_URL}/api/favorite-song`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          track: track
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to favorite track');
      }
  
      const data = await response.json();
      
      if (data.already_favorited) {
        setIsFavorited(true);
      } else {
        setIsFavorited(true);
        // Could show a success notification here
      }
      
    } catch (err) {
      setError('Failed to favorite track');
      console.error('Favorite error:', err);
    } finally {
      setIsFavoriting(false);
    }
  };

  // Render the pin confirmation dialog in a portal
  const renderPinConfirmationPortal = () => {
    if (!showPinConfirmation) return null;
    
    return ReactDOM.createPortal(
      <div className="pin-confirmation-overlay">
        <div className="pin-confirmation-dialog">
          <button className="close-dialog" onClick={cancelPinToTop}>
            <X size={20} />
          </button>
          <h3>Pin Track</h3>
          <p>Pin "{track.title}" to play after the current track?</p>
          <p className="pin-cost">Cost: {pinPrice} Aico Coins</p>
          <p className="pin-balance">Your balance: {user?.coins || 0} Coins</p>
          <div className="pin-actions">
            <button 
              className="cancel-pin" 
              onClick={cancelPinToTop}
              disabled={isPinning}
            >
              Cancel
            </button>
            <button 
              className="confirm-pin" 
              onClick={confirmPinToTop}
              disabled={isPinning || (user?.coins || 0) < pinPrice}
            >
              {isPinning ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <li 
      className={`${isCurrentTrack ? 'track-item active' : 'track-item'}`}
      onClick={() => onTrackClick(index)}
    >
      {track.cover_img_url && (
        <img 
          src={track.cover_img_url} 
          alt=""
          className="track-thumbnail"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      )}
      <span className="track-number">{index + 1}</span>
      <div className="track-details">
        <span className="track-title">{track.title}</span>
        <span className="track-artist">{track.artist}</span>
        <div className="requester-info">
          {track.requested_by_avatar && (
            <img
              src={track.requested_by_avatar}
              alt={track.requested_by_username || "Guest"}
              className="requester-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = "none";
              }}
            />
          )}
          <span className="track-requester">{track.requested_by_username || "Guest"}</span>
          {track.express && (<span className="express-badge" title="Express request">⚡</span>)}
        </div>
        {error && <span className="track-error">{error}</span>}
      </div>
      {isCurrentTrack && (
        <span className="now-playing">▶</span>
      )}
      
      <div className="track-actions">
        {/* Favorite button - available to all users */}
        <button
          onClick={handleFavorite}
          disabled={isFavoriting}
          className={`favorite-button ${isFavorited ? 'favorited' : ''}`}
          title={isFavorited ? "Already in favorites" : "Add to favorites"}
        >
          <Heart className={`heart-icon ${isFavorited ? 'filled' : ''}`} color="#ff4081" />
        </button>
        
        {/* Pin button - available to all users */}
        <button
          onClick={handlePinToTop}
          disabled={isPinning}
          className="pin-button"
          title={isHost ? "Pin after current track" : `Pin after current track (${pinPrice} coins)`}
        >
          <ArrowUp className="pin-icon" />
        </button>
        
        {/* Delete button - host only */}
        {isHost && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="delete-button"
            title="Delete track"
          >
            <Trash2 className="trash-icon" />
          </button>
        )}
      </div>
      
      {/* Render pin confirmation dialog in a portal */}
      {renderPinConfirmationPortal()}
    </li>
  );
};

export default PlaylistTrack;