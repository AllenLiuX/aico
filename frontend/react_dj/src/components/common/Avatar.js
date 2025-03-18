import React, { useState, useEffect } from 'react';
import styles from './Avatar.module.css';
import { API_URL } from '../../config';

const Avatar = ({ src, username, size = 24 }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImageSrc(`/api/placeholder/${size}/${size}`);
      return;
    }

    // Convert relative URLs to absolute URLs
    const fullSrc = src.startsWith('/api/') ? `${API_URL}${src}` : src;
    setImageSrc(fullSrc);
    setHasError(false);
  }, [src, size]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(`/api/placeholder/${size}/${size}`);
    }
  };

  return (
    <img
      src={imageSrc}
      alt={`${username}'s avatar`}
      className={styles.avatar}
      loading="lazy"
      crossOrigin="anonymous"
      onError={handleError}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
};

export default Avatar;
