import React from 'react';
import '../styles/RequestNotificationModal.css';

const RequestNotificationModal = ({ isOpen, onClose, message, title, type = 'info' }) => {
  if (!isOpen) return null;

  return (
    <div className="request-notification-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`request-notification-modal ${type}`}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3 className="notification-title">{title}</h3>
        <p className="notification-message">{message}</p>
        <button className="confirm-button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
};

export default RequestNotificationModal;