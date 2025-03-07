import React, { useState } from 'react';
import { Trash2, ArrowUp } from 'lucide-react';
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
  const [error, setError] = useState(null);

  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent triggering track click when deleting
    
    if (!isHost || isDeleting || !track.song_id) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      
      // Only stop progress tracking if this is the current track
      // This ensures we don't interrupt tracking when deleting other tracks
      if (isCurrentTrack) {
        stopProgressTracking();
      }
        // const response = await fetch('http://127.0.0.1:5000/api/remove-from-playlist', {
      const response = await fetch('http://13.56.253.58:5000/api/remove-from-playlist', {
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

  const handlePinToTop = (e) => {
    e.stopPropagation(); // Prevent triggering track click
    
    if (!isHost || isPinning || isCurrentTrack) return;
    
    try {
      setIsPinning(true);
      setError(null);
      
      // Call the parent function to handle the pin action
      onPinToTop(index, currentPlayingIndex);
      
    } catch (err) {
      setError('Failed to pin track');
      console.error('Pin error:', err);
    } finally {
      setIsPinning(false);
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
      
      {isHost && (
        <div className="track-actions">
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
        </div>
      )}
    </li>
  );
};

export default PlaylistTrack;