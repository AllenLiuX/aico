import React, { useState, useEffect } from 'react';
import { Trash2, ArrowUp, Heart } from 'lucide-react';
import { API_URL } from '../config';
import '../styles/PlaylistTrack.css';

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
    
    if (!isHost || isPinning || isCurrentTrack) return;
    
    try {
      setIsPinning(true);
      setError(null);
      
      // Call the parent function first to get the actual index
      onPinToTop(index, currentPlayingIndex);
      
    } catch (err) {
      setError('Failed to pin track');
      console.error('Pin error:', err);
    } finally {
      setIsPinning(false);
    }
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
        {error && <span className="track-error">{error}</span>}
      </div>
      {isCurrentTrack && !isHost && (
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
        
        {/* Host-only actions */}
        {isHost && (
          <>
            <button
              onClick={handlePinToTop}
              disabled={isPinning || isCurrentTrack}
              className="pin-button"
              title="Pin after current track"
            >
              <ArrowUp className="pin-icon" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="delete-button"
              title="Delete track"
            >
              <Trash2 className="trash-icon" />
            </button>
          </>
        )}
      </div>
    </li>
  );
};

export default PlaylistTrack;