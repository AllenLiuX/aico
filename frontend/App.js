// App.js
import React, { useState } from 'react';
import PreferenceForm from './components/PreferenceForm';
import Playlist from './components/Playlist';
import './App.css';

function App() {
  const [playlist, setPlaylist] = useState(null);

  const generatePlaylist = async (preferences) => {
    try {
      const response = await fetch('/api/generate-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });
      const data = await response.json();
      setPlaylist(data.playlist);
    } catch (error) {
      console.error('Error generating playlist:', error);
    }
  };

  return (
    <div className="App">
      <h1>Music Playlist Generator</h1>
      <PreferenceForm onSubmit={generatePlaylist} />
      {playlist && <Playlist tracks={playlist} />}
    </div>
  );
}

export default App;

// components/PreferenceForm.js
import React, { useState } from 'react';

function PreferenceForm({ onSubmit }) {
  const [genre, setGenre] = useState('');
  const [occasion, setOccasion] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ genre, occasion });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="genre">Music Genre:</label>
        <input
          type="text"
          id="genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="occasion">Occasion:</label>
        <input
          type="text"
          id="occasion"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          required
        />
      </div>
      <button type="submit">Generate Playlist</button>
    </form>
  );
}

export default PreferenceForm;

// components/Playlist.js`
import React from 'react';

function Playlist({ tracks }) {
  return (
    <div className="playlist">
      <h2>Your Playlist</h2>
      <ul>
        {tracks.map((track, index) => (
          <li key={index}>
            {track.title} - {track.artist}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Playlist;