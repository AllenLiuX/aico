// QRCodeModal.js
import React from 'react';

const QRCodeModal = ({ show, roomName, onClose }) => {
  if (!show) return null;
  
  return (
    <div className="qr-code-overlay">
      <div className="qr-code-modal">
        <img 
          src={`/images/qr_code_${roomName}.png`} 
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