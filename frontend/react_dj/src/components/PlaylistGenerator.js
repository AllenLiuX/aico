// Updated PlaylistGenerator.js with mobile-friendly song count selection
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Music, Tag, Calendar, Hash } from 'lucide-react';
import '../styles/PlaylistGenerator.css';

const GENRE_OPTIONS = [
  'Pop', 'Rock', 'Hip Hop', 'Jazz', 'Classical', 'Electronic', 'R&B', 'Country', 'Other'
];

const OCCASION_OPTIONS = [
  'Party', 'Workout', 'Relaxation', 'Study', 'Commute', 'Dinner', 'Other'
];

const SONG_COUNT_OPTIONS = [
  { value: 10, label: '10 songs' },
  { value: 20, label: '20 songs' },
  { value: 30, label: '30 songs' },
  { value: 40, label: '40 songs' }
];

function PlaylistGenerator() {
  const [playlist, setPlaylist] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [moderation, setModeration] = useState('no');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    prompt: '',
    genre: '',
    customGenre: '',
    occasion: '',
    customOccasion: '',
    songCount: 20 // Default to 20 songs
  });
  
  // For detecting mobile view
  const [isMobile, setIsMobile] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setRoomName(params.get('room_name') || '');
    setModeration(params.get('moderation') || 'no');
    
    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add listener for window resize
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [location]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);
    setPlaylist(null);

    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      // const response = await fetch('http://127.0.0.1:5000/api/generate-playlist', {
      const response = await fetch('http://13.56.253.58:5000/api/generate-playlist', {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || '',
        },
        body: JSON.stringify({
          prompt: formData.prompt,
          genre: formData.genre === 'Other' ? formData.customGenre : formData.genre,
          occasion: formData.occasion === 'Other' ? formData.customOccasion : formData.occasion,
          room_name: roomName,
          song_count: parseInt(formData.songCount) // Add the song count to the request
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate playlist');
      }

      const data = await response.json();
      setPlaylist(data.playlist);
    } catch (error) {
      setError('Error generating playlist. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const createRoom = () => {
    navigate(`/playroom?room_name=${encodeURIComponent(roomName)}&moderation=${moderation}&is_host=True`);
  };

  return (
    <div className="playlist-generator">
      <div className="generator-header">
        <h1>{isMobile ? "Create Room" : "AICO Room: " + (roomName || 'Unnamed Room')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="generator-form">
        <div className="form-group">
          <label htmlFor="prompt" className="form-label">
            <Music size={isMobile ? 16 : 18} className="icon" />
            Describe the music you want
          </label>
          <textarea
            id="prompt"
            name="prompt"
            value={formData.prompt}
            onChange={handleInputChange}
            className="prompt-input"
            placeholder="E.g., Upbeat pop songs for a summer road trip"
            required
          />
        </div>

        {/* Song count selector - more visible on mobile */}
        <div className="form-group song-count-group">
          <label htmlFor="songCount" className="form-label">
            <Hash size={isMobile ? 16 : 18} className="icon" />
            Number of songs
          </label>
          <div className="song-count-selector">
            {SONG_COUNT_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                name="songCount"
                value={option.value}
                onClick={handleInputChange}
                className={`song-count-option ${parseInt(formData.songCount) === option.value ? 'selected' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="advanced-toggle"
        >
          {showAdvanced ? <ChevronUp size={isMobile ? 16 : 20} /> : <ChevronDown size={isMobile ? 16 : 20} />}
          {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
        </button>

        {showAdvanced && (
          <div className="advanced-options">
            <div className="option-group">
              <label className="option-label">
                <Tag size={isMobile ? 16 : 18} className="icon" />
                Music Genre
              </label>
              <select
                name="genre"
                value={formData.genre}
                onChange={handleInputChange}
                className="option-select"
              >
                <option value="">Select a genre</option>
                {GENRE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {formData.genre === 'Other' && (
                <input
                  type="text"
                  name="customGenre"
                  value={formData.customGenre}
                  onChange={handleInputChange}
                  placeholder="Enter custom genre"
                  className="custom-input"
                />
              )}
            </div>

            <div className="option-group">
              <label className="option-label">
                <Calendar size={isMobile ? 16 : 18} className="icon" />
                Occasion
              </label>
              <select
                name="occasion"
                value={formData.occasion}
                onChange={handleInputChange}
                className="option-select"
              >
                <option value="">Select an occasion</option>
                {OCCASION_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {formData.occasion === 'Other' && (
                <input
                  type="text"
                  name="customOccasion"
                  value={formData.customOccasion}
                  onChange={handleInputChange}
                  placeholder="Enter custom occasion"
                  className="custom-input"
                />
              )}
            </div>
          </div>
        )}

        <button type="submit" className="generate-button" disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Playlist'}
        </button>
      </form>

      {isGenerating && (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p className="loading-text">Generating your playlist...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {playlist && !isGenerating && (
        <div className="playlist-container">
          <div className="playlist-header">
            <h2 className="playlist-title">Your Generated Playlist</h2>
            <p className="playlist-description">
              Here's what we've created based on your preferences
            </p>
          </div>

          <button onClick={createRoom} className="create-room-button">
            Create Room with This Playlist
          </button>
          
          <div className="playlist-tracks">
            {playlist.map((track, index) => (
              <div key={index} className="playlist-track">
                <img
                  src={track.cover_img_url || '/api/placeholder/48/48'}
                  alt={track.title}
                  className="track-thumbnail"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/api/placeholder/48/48';
                  }}
                />
                <div className="track-info">
                  <h3 className="track-name">{track.title}</h3>
                  <p className="track-artist">{track.artist}</p>
                </div>
                <a
                  href={track.song_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="play-button"
                >
                  Preview
                </a>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

export default PlaylistGenerator;