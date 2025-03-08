// RoomHeader.js with fixed share button functionality
import React, { useState } from 'react';
import { Share2, QrCode } from 'lucide-react';

const RoomHeader = ({ roomName, hostData, showQRCode, setShowQRCode }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const copyShareLink = (e) => {
    // Prevent default action and stop propagation
    e.preventDefault();
    e.stopPropagation();

    // The URL to be copied - use the current domain to ensure it works on all environments
    // Replace 'aico-music.com' with the proper domain or use window.location for dynamic detection
    const currentDomain = window.location.origin;
    const shareLink = `${currentDomain}/playroom?room_name=${encodeURIComponent(roomName)}`;

    try {
      // Method 1: Using the Clipboard API (modern browsers)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareLink)
          .then(() => {
            setCopySuccess(true);
            setShowTooltip(true);
            setTimeout(() => setShowTooltip(false), 2000);
          })
          .catch(err => {
            console.error("Failed to copy with Clipboard API:", err);
            // Fall back to execCommand method
            fallbackCopyTextToClipboard(shareLink);
          });
      } else {
        // Method 2: Using document.execCommand (fallback for older browsers)
        fallbackCopyTextToClipboard(shareLink);
      }
    } catch (err) {
      console.error("Copy failed:", err);
      setCopySuccess(false);
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    }
  };

  const fallbackCopyTextToClipboard = (text) => {
    // Create a temporary textarea element
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    
    // Select and copy the text
    textArea.focus();
    textArea.select();
    
    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Could not copy text: ', err);
    }
    
    document.body.removeChild(textArea);
    
    setCopySuccess(successful);
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <div className="room-header">
      <div className="room-info">
        <h1>{roomName}</h1>
        <div className="host-info">
          {hostData ? (
            <>
              <img 
                src={hostData.avatar} 
                alt={`${hostData.username}'s avatar`}
                className="host-avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/api/placeholder/24/24';
                }}
              />
              <span>Created by {hostData.username}</span>
            </>
          ) : (
            <span>Public Room</span>
          )}
        </div>
      </div>
      <div className="room-controls">
        <button 
          onClick={() => setShowQRCode(true)} 
          className="control-button"
          aria-label="Show QR Code"
        >
          <QrCode size={20} />
        </button>
        <div className="share-button-container">
          <button 
            onClick={copyShareLink} 
            className="share-button"
            aria-label="Share Room"
          >
            <Share2 size={20} />
            Share Room
          </button>
          {showTooltip && (
            <div className={`tooltip ${copySuccess ? 'success' : 'error'}`}>
              {copySuccess ? 'Link copied!' : 'Copy failed. Try again.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomHeader;