// RoomHeader.js
import React, { useState } from 'react';
import { Share2, QrCode } from 'lucide-react';

const RoomHeader = ({ roomName, hostData, showQRCode, setShowQRCode }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const copyShareLink = () => {
    const shareLink = `http://aico-music.com/playroom?room_name=${roomName}`;
    navigator.clipboard.writeText(shareLink).then(() => {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    });
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
              />
              <span>Created by {hostData.username}</span>
            </>
          ) : (
            <span>Public Room</span>
          )}
        </div>
      </div>
      <div className="room-controls">
        <button onClick={() => setShowQRCode(true)} className="control-button">
          <QrCode size={20} />
        </button>
        <button onClick={copyShareLink} className="share-button">
          <Share2 size={20} />
          Share Room
        </button>
        {showTooltip && <div className="tooltip">Link copied!</div>}
      </div>
    </div>
  );
};

export default RoomHeader;