// Updated PlaylistGenerator.js with mobile-friendly song count selection
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Music, Tag, Calendar, Hash, Lightbulb, Lock, Settings } from 'lucide-react';
import { API_URL } from '../config';
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
  const [isAppendMode, setIsAppendMode] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [combinedPlaylistLength, setCombinedPlaylistLength] = useState(0);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [showExamplePrompts, setShowExamplePrompts] = useState(false);
  const [examplePrompts, setExamplePrompts] = useState([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
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
    const roomNameParam = params.get('room_name') || '';
    const moderationParam = params.get('moderation') || 'no';
    
    setRoomName(roomNameParam);
    
    // Handle both 'yes'/'no' and 'True'/'False' formats for moderation
    if (moderationParam === 'True' || moderationParam === 'yes') {
      setModeration('yes');
    } else {
      setModeration('no');
    }
    
    setIsAppendMode(params.get('append') === 'True');
    setIsHost(params.get('is_host') === 'True');
    
    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [location.search]);

  // Fetch example prompts from the backend
  const fetchExamplePrompts = async () => {
    if (examplePrompts.length > 0) {
      // If we already have examples, just show them
      setShowExamplePrompts(!showExamplePrompts);
      return;
    }

    setIsLoadingExamples(true);
    try {
      const response = await fetch(`${API_URL}/api/example-prompts`);
      if (!response.ok) {
        throw new Error('Failed to fetch example prompts');
      }
      
      const data = await response.json();
      setExamplePrompts(data.examples);
      setShowExamplePrompts(true);
    } catch (error) {
      console.error('Error fetching example prompts:', error);
      // If we can't fetch examples, still show the toggle but with an error message
      setError('Could not load example prompts. Please try again later.');
    } finally {
      setIsLoadingExamples(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'roomName') {
      setRoomName(value);
    } else if (name === 'moderation') {
      setModeration(checked ? 'yes' : 'no');
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleExamplePromptClick = (example) => {
    setFormData(prev => ({
      ...prev,
      prompt: example.prompt,
      genre: example.genre,
      occasion: example.occasion,
      customGenre: example.genre === 'Other' ? 'Custom' : '',
      customOccasion: example.occasion === 'Other' ? 'Custom' : ''
    }));
    
    // Show advanced options if the example uses them
    if (example.genre || example.occasion) {
      setShowAdvanced(true);
    }
    
    // Hide examples after selection
    setShowExamplePrompts(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');
    setDuplicatesRemoved(0);
    setIsGenerating(true);
    setPlaylist(null);

    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/generate-playlist`, {
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
          moderation: moderation, // Include moderation setting
          song_count: parseInt(formData.songCount), // Add the song count to the request
          append_to_room: isAppendMode // Add flag to indicate if we should append to existing room
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate playlist');
      }

      const data = await response.json();
      setPlaylist(data.playlist);
      
      // If we're in append mode and got combined playlist length, show success message
      if (isAppendMode && data.combined_playlist_length) {
        setCombinedPlaylistLength(data.combined_playlist_length);
        setDuplicatesRemoved(data.duplicates_removed || 0);
        
        let message = `${data.playlist.length} songs will be added to your playlist, making a total of ${data.combined_playlist_length} songs.`;
        
        if (data.duplicates_removed && data.duplicates_removed > 0) {
          message += ` ${data.duplicates_removed} duplicate ${data.duplicates_removed === 1 ? 'song was' : 'songs were'} automatically removed.`;
        }
        
        setSuccessMessage(message);
      }
    } catch (error) {
      setError('Error generating playlist. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const createRoom = () => {
    if (isAppendMode) {
      // If in append mode, navigate back to the playroom
      navigate(`/playroom?room_name=${encodeURIComponent(roomName)}&moderation=${moderation === 'yes' ? 'True' : 'False'}&is_host=${isHost ? 'True' : 'False'}`);
    } else {
      // Create a new room
      navigate(`/playroom?room_name=${encodeURIComponent(roomName)}&moderation=${moderation === 'yes' ? 'True' : 'False'}&is_host=True`);
    }
  };

  return (
    <div className="playlist-generator">
      {/* Animated wave element */}
      <div className="playlist-wave"></div>
      
      {/* Animated music notes */}
      <div className="playlist-notes"></div>
      
      <div className="generator-header">
        <h1>{isMobile ? (isAppendMode ? "Add to Room" : "Create Room") : "AICO Room: " + (roomName || 'Unnamed Room')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="generator-form">
        {/* Room Settings Section */}
        <div className="room-settings-section">
          <div className="form-group">
            <label htmlFor="roomName" className="form-label">
              <Lock size={isMobile ? 16 : 18} className="icon" />
              Room Name
            </label>
            <input
              type="text"
              id="roomName"
              name="roomName"
              value={roomName}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter a name for your room"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Settings size={isMobile ? 16 : 18} className="icon" />
              Moderation
            </label>
            <div className="toggle-label">
              <span>Enable moderation</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  name="moderation"
                  className="toggle-input"
                  checked={moderation === 'yes'}
                  onChange={handleInputChange}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

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
          
          {/* Example prompts toggle button */}
          <button 
            type="button" 
            className="example-prompts-toggle"
            onClick={fetchExamplePrompts}
            disabled={isLoadingExamples}
          >
            <Lightbulb size={16} />
            {isLoadingExamples 
              ? 'Loading examples...' 
              : showExamplePrompts 
                ? 'Hide Examples' 
                : 'Need ideas? See examples'}
          </button>
          
          {/* Example prompts section */}
          {showExamplePrompts && (
            <div className="example-prompts-container">
              <h3>Example Prompts</h3>
              <p className="example-prompts-description">
                Click on any example below to use it as a starting point for your playlist:
              </p>
              
              {/* Group examples by category */}
              {examplePrompts.length > 0 && 
                [...new Set(examplePrompts.map(example => example.category))].map(category => (
                  <div key={category} className="example-prompts-category">
                    <h4 className="category-title">{category}</h4>
                    <div className="example-prompts-grid">
                      {examplePrompts
                        .filter(example => example.category === category)
                        .map((example, index) => (
                          <div 
                            key={index} 
                            className="example-prompt-card"
                            onClick={() => handleExamplePromptClick(example)}
                          >
                            <h4>{example.title}</h4>
                            <p>{example.prompt}</p>
                            <div className="example-prompt-tags">
                              {example.genre && <span className="example-tag genre-tag">{example.genre}</span>}
                              {example.occasion && example.occasion !== 'Other' && 
                                <span className="example-tag occasion-tag">{example.occasion}</span>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
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

        {/* Error message */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Success message for append mode */}
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        <button 
          type="submit" 
          className="generate-button"
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : isAppendMode ? 'Generate More Songs' : 'Generate Playlist'}
        </button>
      </form>

      {/* Loading state */}
      {isGenerating && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Generating your playlist...</p>
        </div>
      )}

      {/* Generated playlist */}
      {playlist && !isGenerating && (
        <div className="playlist-container">
          <div className="playlist-header">
            <h2 className="playlist-title">Generated Playlist</h2>
            <p className="playlist-description">
              {isAppendMode 
                ? 'These songs will be added to your room when you click "Add to Room".' 
                : 'Your playlist is ready! Click "Create Room" to start listening.'}
            </p>
          </div>

          <ul className="track-list">
            {playlist.map((track, index) => (
              <li key={index} className="track-item">
                <div className="track-info">
                  <h3 className="track-name">{track.title}</h3>
                  <p className="track-artist">{track.artist}</p>
                </div>
                {track.song_url && (
                  <a 
                    href={track.song_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="play-link"
                  >
                    <Music size={14} />
                    Preview
                  </a>
                )}
              </li>
            ))}
          </ul>

          <button 
            onClick={createRoom} 
            className="create-room-button"
          >
            {isAppendMode ? 'Add to Room' : 'Create Room'}
          </button>
        </div>
      )}
    </div>
  );
}

export default PlaylistGenerator;