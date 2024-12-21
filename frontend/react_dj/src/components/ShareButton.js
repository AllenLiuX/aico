// components/ShareButton.js
import React, { useState } from 'react';

function ShareButton() {
  const [showTooltip, setShowTooltip] = useState(false);

  const generateRoomId = () => {
    return Math.random().toString().slice(2, 11);
  };

  const copyShareLink = () => {
    const roomId = generateRoomId();
    const shareLink = `www.aico-music.com/share?roomId=${roomId}`;
    // const shareLink = `http://localhost:3000/playroom?room_name={roomId}&is_host=False`;
    
    navigator.clipboard.writeText(shareLink).then(() => {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    });
  };

  return (
    <div className="share-button-container">
      <button onClick={copyShareLink} className="share-button">
        Share Room and Invite Friends ⚡️
      </button>
      {showTooltip && <div className="tooltip">Link copied!</div>}
    </div>
  );
}

export default ShareButton;