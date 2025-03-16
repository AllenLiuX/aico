// PendingTrack.js
import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { API_URL } from '../config';
import '../styles/PendingTrack.css';

const PendingTrack = ({ 
  track,
  index,
  roomName,
  onApprove,
  onReject,
  requestedBy
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleApprove = async (e) => {
    e.stopPropagation();
    
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/api/approve-track-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          track_id: track.song_id,
          request_id: track.request_id,
          requester_id: requestedBy
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to approve track');
      }
  
      const data = await response.json();
      onApprove(data);
      
    } catch (err) {
      setError('Failed to approve track');
      console.error('Approval error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e) => {
    e.stopPropagation();
    
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/api/reject-track-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          track_id: track.song_id,
          request_id: track.request_id,
          requester_id: requestedBy
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to reject track');
      }
  
      const data = await response.json();
      onReject(data);
      
    } catch (err) {
      setError('Failed to reject track');
      console.error('Rejection error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <li className="pending-track-item">
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
        <span className="track-requester">Requested by: {requestedBy || "Guest"}</span>
        {error && <span className="track-error">{error}</span>}
      </div>
      
      <div className="track-actions">
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          className="approve-button"
          title="Approve track"
        >
          <Check className="check-icon" />
        </button>
        <button
          onClick={handleReject}
          disabled={isProcessing}
          className="reject-button"
          title="Reject track"
        >
          <X className="x-icon" />
        </button>
      </div>
    </li>
  );
};

export default PendingTrack;