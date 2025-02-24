// AvatarUpload.js
import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

const AvatarUpload = ({ onUpload, onClose, show }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // AvatarUpload.js
const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create FormData
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setUploading(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await fetch('http://13.56.253.58:5000/api/user/avatar', {
        method: 'POST',
        headers: {
          'Authorization': token
          // Do NOT set Content-Type header - browser will set it automatically for FormData
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onUpload(data.avatar_url);
      onClose();

    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="avatar-upload-popover">
      <button className="close-btn" onClick={onClose}>
        <X size={16} />
      </button>
      <div className="upload-options">
        <button 
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload Photo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
};

export default AvatarUpload;