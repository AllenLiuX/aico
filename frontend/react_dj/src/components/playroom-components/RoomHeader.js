// Updated RoomHeader.js with improved host info and social buttons display
import React, { useState } from 'react';
import { Share2, QrCode, Calendar } from 'lucide-react';
import SocialActionButtons from './SocialActionButtons';
import Avatar from '../common/Avatar';
import { formatRoomName } from '../../utils/formatRoomName';

const RoomHeader = ({ roomName, hostData, showQRCode, setShowQRCode, roomInfo }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const copyShareLink = (e) => {
    // Prevent default action and stop propagation
    e.preventDefault();
    e.stopPropagation();

    // The URL to be copied
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

  // Format the created_at date if available
  const formatCreationDate = (dateString) => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
    }
  };

  const creationDate = hostData?.created_at ? formatCreationDate(hostData.created_at) : null;

  return (
    <div className="room-header">
      <div className="room-info">
        <h1>{formatRoomName(roomName)}</h1>
        
        {/* Host info with social buttons in a container for better layout */}
        {hostData && (
          <div className="host-container">
            <div className="host-info">
              <Avatar 
                src={hostData.avatar}
                username={hostData.username}
                size={24}
              />
              <span>Created by {hostData.username}</span>
              
              {/* Display creation date if available */}
              {creationDate && (
                <div className="creation-date">
                  <Calendar size={14} />
                  <span>Created on {creationDate}</span>
                </div>
              )}
            </div>
            
            {/* Social Action Buttons - moved outside of host-info for better spacing */}
            <SocialActionButtons 
              roomName={roomName} 
              hostUsername={hostData.username}
              roomInfo={roomInfo}
            />
          </div>
        )}
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