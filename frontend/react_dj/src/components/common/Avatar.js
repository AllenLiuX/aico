import React, { useState, useEffect } from 'react';
import styles from './Avatar.module.css';
import { API_URL, host_by_https } from '../../config';

const Avatar = ({ src, username, size = 24, onClick, className = "" }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      // If no source is provided, use the username to create a consistent avatar URL
      if (username) {
        // Add timestamp to prevent caching issues
        const timestamp = Date.now();
        setImageSrc(`${API_URL}/api/avatar/${username}`);
      } else {
        setImageSrc(`${API_URL}/api/placeholder/${size}/${size}`);
      }
      return;
    }

    // Handle different URL formats
    let fullSrc;
    if (src.startsWith('http:') && host_by_https) {
      // Convert HTTP to HTTPS if needed
      fullSrc = src.replace('http:', 'https:');
    } else if (src.startsWith('/api/')) {
      // Convert relative URLs to absolute URLs
      fullSrc = `${API_URL}${src}`;
    } else {
      fullSrc = src;
    }
    
    setImageSrc(fullSrc);
    setHasError(false);
  }, [src, size, username]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      // If image fails to load, fall back to the API avatar endpoint
      if (username) {
        setImageSrc(`${API_URL}/api/avatar/${username}`);
      } else {
        setImageSrc(`${API_URL}/api/placeholder/${size}/${size}`);
      }
    }
  };

  return (
    <img
      src={imageSrc}
      alt={`${username || 'User'}'s avatar`}
      className={`${styles.avatar} ${className}`}
      loading="lazy"
      crossOrigin="anonymous"
      onError={handleError}
      onClick={onClick}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
};

export default Avatar;
