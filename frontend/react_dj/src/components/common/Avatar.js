import React, { useState, useEffect } from 'react';
import styles from './Avatar.module.css';
import { API_URL, host_by_https } from '../../config';

const Avatar = ({ src, username, size = 24, onClick, className = "" }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error state when src or username changes
    setHasError(false);

    if (!src) {
      // If no source is provided, use the username to get avatar from backend
      if (username) {
        setImageSrc(`${API_URL}/api/avatar/${username}`);
      } else {
        setImageSrc(`${API_URL}/api/placeholder/${size}/${size}`);
      }
      return;
    }

    // Handle different URL formats
    let fullSrc;
    if (src.startsWith('http:') && host_by_https) {
      fullSrc = src.replace('http:', 'https:');
    } else if (src.startsWith('/api/')) {
      fullSrc = `${API_URL}${src}`;
    } else {
      fullSrc = src;
    }
    
    setImageSrc(fullSrc);
  }, [src, size, username]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      // If image fails to load and we're not already using the API avatar endpoint
      if (!imageSrc?.includes('/api/avatar/')) {
        setImageSrc(`${API_URL}/api/avatar/${username}`);
      } else if (username) {
        // If we're already at the avatar endpoint and it failed, use placeholder
        setImageSrc(`${API_URL}/api/placeholder/${size}/${size}`);
      }
    }
  };

  return (
    <img
      src={imageSrc}
      alt={username ? `${username}'s avatar` : 'Avatar'}
      className={`${styles.avatar} ${className}`}
      style={{ width: size, height: size }}
      onError={handleError}
      onClick={onClick}
    />
  );
};

export default Avatar;
