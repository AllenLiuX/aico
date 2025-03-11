// LyricsSection.js - Fixed scrolling and rerender issues
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Loader, AlertCircle, Clock } from 'lucide-react';
import '../styles/LyricsSection.css';

const LyricsSection = ({ 
  currentSong, 
  isVisible, 
  currentTime = 0,
  preventPageScroll = true,
  onCurrentLineChange = () => {}, // New callback to report current line to parent
  initialLineIndex = -1 // Allow parent to pass initial line index for restoration
}) => {
  const [lyrics, setLyrics] = useState('');
  const [timedLyrics, setTimedLyrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(initialLineIndex);
  const [lyricsSource, setLyricsSource] = useState('');
  const lyricsRef = useRef(null);
  const activeLine = useRef(null);
  const hasScrolledToCurrentLine = useRef(false);
  const isFirstRender = useRef(true);

  // Reset states when song changes
  useEffect(() => {
    setLyrics('');
    setTimedLyrics([]);
    setCurrentLineIndex(-1);
    setError(null);
    hasScrolledToCurrentLine.current = false;
    
    // Only fetch lyrics if we have a current song and the component is visible
    if (currentSong?.title && currentSong?.artist && isVisible) {
      fetchLyrics(currentSong.title, currentSong.artist);
    }
  }, [currentSong?.title, currentSong?.artist, isVisible]);

  // Effect for when component first mounts or becomes visible
  useEffect(() => {
    if (!isVisible) return;
    
    // Reset the scroll position flag when lyrics are toggled
    hasScrolledToCurrentLine.current = false;
    
    // If we have a specific initial line from the parent, use it
    if (initialLineIndex >= 0 && timedLyrics.length > initialLineIndex) {
      setCurrentLineIndex(initialLineIndex);
      
      // Schedule a scroll to this line after render
      setTimeout(() => {
        if (activeLine.current && lyricsRef.current) {
          scrollToActiveLine(activeLine.current, lyricsRef.current, true);
        }
      }, 100);
    }
  }, [isVisible, initialLineIndex, timedLyrics.length]);

  // Helper function to scroll to active line
  const scrollToActiveLine = (element, container, force = false) => {
    if (!element || !container) return;
    
    // Skip if we've already scrolled to current line and not forced
    if (hasScrolledToCurrentLine.current && !force) return;
    
    // Calculate how far to scroll - center the active lyric in the container
    const scrollTop = element.offsetTop - container.offsetTop - 
                    (container.clientHeight / 2) + (element.clientHeight / 2);
    
    // Use requestAnimationFrame to ensure this happens after layout updates
    requestAnimationFrame(() => {
      // Scroll only within the container - this is the key fix
      container.scrollTo({
        top: scrollTop,
        behavior: isFirstRender.current ? 'auto' : 'smooth' // First scroll is instant
      });
      
      // Mark that we've scrolled to the current line
      hasScrolledToCurrentLine.current = true;
      isFirstRender.current = false;
    });
  };

  // Effect for tracking current lyric line based on currentTime
  useEffect(() => {
    if (!timedLyrics.length || currentTime === 0) return;
    
    // Convert current time to milliseconds for comparison with lyric timestamps
    const currentTimeMs = currentTime * 1000;
    
    // Find the current line based on timestamp
    let foundIndex = -1;
    
    for (let i = 0; i < timedLyrics.length; i++) {
      if (currentTimeMs >= timedLyrics[i].time) {
        foundIndex = i;
      } else {
        break;
      }
    }
    
    if (foundIndex !== currentLineIndex) {
      setCurrentLineIndex(foundIndex);
      
      // Notify parent of line change
      onCurrentLineChange(foundIndex);
      
      // Only scroll if we have proper references to the elements
      if (foundIndex >= 0 && lyricsRef.current) {
        // We'll get the activeLine ref in the next render, so delay the scroll
        setTimeout(() => {
          if (activeLine.current && lyricsRef.current) {
            scrollToActiveLine(activeLine.current, lyricsRef.current);
          }
        }, 50);
      }
    }
  }, [currentTime, timedLyrics, currentLineIndex, onCurrentLineChange]);

  const fetchLyrics = async (title, artist) => {
    setLoading(true);
    try {
      const response = await fetch(`http://13.56.253.58:5000/api/get-lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&timestamps=true`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch lyrics');
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setLyrics('');
        setTimedLyrics([]);
      } else {
        setLyrics(data.lyrics);
        setLyricsSource(data.source || '');
        
        // Set timed lyrics if available
        if (data.timedLyrics && data.timedLyrics.length > 0) {
          setTimedLyrics(data.timedLyrics);
        } else {
          // If no timed lyrics, create basic structure from formatted lyrics
          const basicTimedLyrics = data.lyrics.split('\n').map((line, index) => ({
            time: index * 5000,  // Placeholder times, 5 seconds apart
            text: line
          }));
          setTimedLyrics(basicTimedLyrics);
        }
        
        setError(null);
        
        // Reset scrolling state when new lyrics load
        hasScrolledToCurrentLine.current = false;
        isFirstRender.current = true;
      }
    } catch (err) {
      setError('Unable to load lyrics. Please try again later.');
      console.error('Lyrics fetch error:', err);
      setLyrics('');
      setTimedLyrics([]);
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp for display (MM:SS)
  const formatTimestamp = (timeMs) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="lyrics-section">
      <div className="lyrics-header">
        <h3>
          <FileText size={16} className="icon" />
          Lyrics
          {lyricsSource && <span className="lyrics-source">Source: {lyricsSource}</span>}
        </h3>
      </div>
      
      <div className="lyrics-content" ref={lyricsRef}>
        {loading ? (
          <div className="lyrics-loading">
            <Loader size={24} className="spin" />
            <p>Loading lyrics...</p>
          </div>
        ) : error ? (
          <div className="lyrics-error">
            <AlertCircle size={24} />
            <p>{error}</p>
          </div>
        ) : timedLyrics.length > 0 ? (
          <div className="lyrics-text timed">
            {timedLyrics.map((line, index) => (
              <div 
                key={index}
                ref={currentLineIndex === index ? activeLine : null}
                className={`lyric-line ${currentLineIndex === index ? 'active' : ''} ${index < currentLineIndex ? 'past' : ''}`}
              >
                <span className="lyric-timestamp">
                  <Clock size={12} />
                  {formatTimestamp(line.time)}
                </span>
                <span className="lyric-content">{line.text || ' '}</span>
              </div>
            ))}
          </div>
        ) : lyrics ? (
          <div className="lyrics-text">
            {lyrics.split('\n').map((line, index) => (
              <p key={index}>{line || ' '}</p>
            ))}
          </div>
        ) : (
          <div className="lyrics-placeholder">
            <FileText size={24} />
            <p>No lyrics available for this song</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsSection;