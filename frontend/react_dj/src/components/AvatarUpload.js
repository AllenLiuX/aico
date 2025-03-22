// AvatarUpload.js
import React, { useState, useRef } from 'react';
import { Upload, X } from 'react-feather';
import { API_URL } from '../config';
import './AvatarUpload.css';

const AvatarUpload = ({ onUploadSuccess, onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    // Automatically start upload when file is selected
    uploadFile(file);
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      console.log('Uploading avatar...');
      console.log('Using API URL:', API_URL);
      const response = await fetch(`${API_URL}/api/user/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': localStorage.getItem('token')
        },
        body: formData
      });

      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', errorText);
        throw new Error(errorText || 'Failed to upload avatar');
      }

      const data = await response.json();
      console.log('Upload response data:', data);
      
      setUploading(false);
      onUploadSuccess(data.avatar_url);
      onClose();
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setError(err.message || 'Failed to upload avatar');
      setUploading(false);
    }
  };

  return (
    <div className="avatar-upload-container">
      <div className="avatar-upload-header">
        <h3>Upload Profile Picture</h3>
        <button className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      
      <div className="upload-options">
        <button 
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Choose File'}
        </button>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          style={{ display: 'none' }}
        />
      </div>
      
      {error && <div className="upload-error">{error}</div>}
      
      <div className="upload-instructions">
        <p>Select an image file to upload as your profile picture.</p>
        <p>Recommended size: 400x400 pixels</p>
      </div>
    </div>
  );
};

export default AvatarUpload;