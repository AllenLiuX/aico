// components/RequestConfirmModal.js
import React from 'react';
import '../styles/RequestConfirmModal.css';

const RequestConfirmModal = ({ isOpen, onClose, onConfirm, requestedTrack, currentTrack }) => {
  if (!isOpen) return null;

  return (
    <div className="request-confirm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="request-confirm-modal">
        <button className="close-button" onClick={onClose}>×</button>
        
        <h3 className="modal-title">Confirm Song Request</h3>
        
        <div className="tracks-comparison">
          <div className="track-info-container">
            <h4>You're requesting:</h4>
            <div className="track-card requested-track">
              {requestedTrack.cover_img_url && (
                <img 
                  src={requestedTrack.cover_img_url} 
                  alt={requestedTrack.title}
                  className="track-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/api/placeholder/80/80';
                  }}
                />
              )}
              <div className="track-details">
                <div className="track-title">{requestedTrack.title}</div>
                <div className="track-artist">{requestedTrack.artist}</div>
              </div>
            </div>
          </div>

          {currentTrack && Object.keys(currentTrack).length > 0 && (
            <div className="track-info-container">
              <h4>Currently playing:</h4>
              <div className="track-card current-track">
                {currentTrack.cover_img_url && (
                  <img 
                    src={currentTrack.cover_img_url} 
                    alt={currentTrack.title}
                    className="track-image"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/api/placeholder/80/80';
                    }}
                  />
                )}
                <div className="track-details">
                  <div className="track-title">{currentTrack.title}</div>
                  <div className="track-artist">{currentTrack.artist}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="request-message">
          <p>Your song request will be sent to the room host for approval.</p>
        </div>
        
        <div className="modal-buttons">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="confirm-button" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestConfirmModal;