// QRCodeModal.js
import React from 'react';

const QRCodeModal = ({ show, roomName, onClose }) => {
  if (!show) return null;
  
  // Sanitize room name for file path (replace slashes and other unsafe characters)
  const safeRoomName = roomName.replace(/[/\\]/g, '_');
  
  return (
    <div className="qr-code-overlay">
      <div className="qr-code-modal">
        <img 
          src={`/images/qr_code_${safeRoomName}.png`} 
          alt="Room QR Code" 
        />
        <div className="qr-code-buttons">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;