// PlaylistGenerator.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Music, Tag, Calendar } from 'lucide-react';
import '../styles/PlaylistGenerator.css';

const GENRE_OPTIONS = [
  'Pop', 'Rock', 'Hip Hop', 'Jazz', 'Classical', 'Electronic', 'R&B', 'Country', 'Other'
];

const OCCASION_OPTIONS = [
  'Party', 'Workout', 'Relaxation', 'Study', 'Commute', 'Dinner', 'Other'
];

function PlaylistGenerator() {
  const [playlist, setPlaylist] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [moderation, setModeration] = useState('no');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    prompt: '',
    genre: '',
    customGenre: '',
    occasion: '',
    customOccasion: ''
  });
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setRoomName(params.get('room_name') || '');
    setModeration(params.get('moderation') || 'no');
  }, [location]);

  const generatePlaylist = async (preferences) => {
    try {
      const response = await fetch('http://13.56.253.58:5000/api/generate-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...preferences, room_name: roomName }),
      });
      const data = await response.json();
      setPlaylist(data.playlist);
    } catch (error) {
      console.error('Error generating playlist:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const preferences = {
      prompt: formData.prompt,
      genre: formData.genre === 'Other' ? formData.customGenre : formData.genre,
      occasion: formData.occasion === 'Other' ? formData.customOccasion : formData.occasion
    };
    generatePlaylist(preferences);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const createRoom = () => {
    navigate(`/playroom?room_name=${encodeURIComponent(roomName)}&moderation=${moderation}&is_host=True`);
  };

  return (
    <div className="playlist-generator">
      <div className="generator-header">
        <h1>AICO Room: {roomName || 'Unnamed Room'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="generator-form">
        <div className="form-group">
          <label htmlFor="prompt" className="form-label">
            <Music size={18} className="icon" />
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

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="advanced-toggle"
        >
          {showAdvanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
        </button>

        {showAdvanced && (
          <div className="advanced-options">
            <div className="option-group">
              <label className="option-label">
                <Tag size={18} className="icon" />
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
                <Calendar size={18} className="icon" />
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

        <button type="submit" className="generate-button">
          Generate Playlist
        </button>
      </form>

      {playlist && (
        <div className="playlist-container">
          <div className="playlist-header">
            <h2 className="playlist-title">Your Generated Playlist</h2>
            <p className="playlist-description">
              Here's what we've created based on your preferences
            </p>
          </div>

          <ul className="track-list">
            {playlist.map((track, index) => (
              <li key={index} className="track-item">
                <div className="track-info">
                  <h3 className="track-name">{track.title}</h3>
                  <p className="track-artist">{track.artist}</p>
                </div>
                <a
                  href={track.song_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="play-link"
                >
                  Listen
                </a>
              </li>
            ))}
          </ul>

          <button onClick={createRoom} className="create-room-button">
            Create Room with This Playlist
          </button>
        </div>
      )}
    </div>
  );
}

export default PlaylistGenerator;


// // components/PlaylistGenerator.js
// import React, { useState, useEffect } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import PreferenceForm from './PreferenceForm';
// import Playlist from './Playlist';
// import ShareButton from './ShareButton';

// import '../styles/PlaylistGenerator.css';

// function PlaylistGenerator() {
//   const [playlist, setPlaylist] = useState(null);
//   const [roomName, setRoomName] = useState('');
//   const [moderation, setModeration] = useState('no');
//   const location = useLocation();
//   const navigate = useNavigate();

//   useEffect(() => {
//     const params = new URLSearchParams(location.search);
//     setRoomName(params.get('room_name') || '');
//     setModeration(params.get('moderation') || 'no');
//   }, [location]);

//   const generatePlaylist = async (preferences) => {
//     try {
//       // const response = await fetch('http://127.0.0.1:5000/api/generate-playlist', {  # local
//       const response = await fetch('http://13.56.253.58:5000/api/generate-playlist', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ ...preferences, room_name: roomName }),
//       });
//       const data = await response.json();
//       setPlaylist(data.playlist);
//     } catch (error) {
//       console.error('Error generating playlist:', error);
//     }
//   };

//   const createRoom = () => {
//     navigate(`/playroom?room_name=${encodeURIComponent(roomName)}&moderation=${moderation}&is_host=True`);
//   };

//   return (
//     <div className="playlist-generator">
//       <header>
//         <h1>ALCO Room: {roomName || 'Unnamed Room'}</h1>
//         {/* <ShareButton /> */}
//       </header>
//       <PreferenceForm onSubmit={generatePlaylist} />
//       {playlist && <Playlist tracks={playlist} />}
//       {playlist && <button onClick={createRoom} className="big-button">Create Room</button>}
//     </div>
//   );
// }

// export default PlaylistGenerator;