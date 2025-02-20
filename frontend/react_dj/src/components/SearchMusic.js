import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SearchMusic.css'; // Importing the dedicated CSS file

function SearchMusic() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchType, setSearchType] = useState('artist'); // Default search type is 'artist'
  
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room');

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://13.56.253.58:5000/api/search-music?query=${encodeURIComponent(searchQuery)}&search_type=${searchType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }
      const data = await response.json();
      setSearchResults(data.tracks);
    } catch (err) {
      setError('An error occurred while searching for music. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToPlaylist = async (track) => {
    try {
      const response = await fetch(`http://13.56.253.58:5000/api/add-to-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          track: track,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add track to playlist');
      }

      alert('Track added to playlist successfully!');
    } catch (err) {
      alert('Failed to add track to playlist. Please try again.');
      console.error('Add to playlist error:', err);
    }
  };

  const toggleSearchType = () => {
    setSearchType(prevType => prevType === 'artist' ? 'song' : 'artist');
  };

  return (
    <div className="search-music">
      <header>
        <h1>Search Music</h1>
      </header>

      <section className="playlist-info">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Enter ${searchType === 'artist' ? 'artist' : 'song'} name`}
            className="search-input"
          />
          <button type="submit" disabled={isLoading} className="search-button">
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
        
        <div className="search-toggle">
          <span className={searchType === 'artist' ? 'active' : ''}>Artist</span>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={searchType === 'song'}
              onChange={toggleSearchType}
            />
            <span className="slider round"></span>
          </label>
          <span className={searchType === 'song' ? 'active' : ''}>Song</span>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <main className="playlist-container">
        <ul className="search-results">
          {searchResults.map((track) => (
            <li key={track.id} className="track-item">
              <img src={track.image_url} alt={`${track.title} cover`} className="track-image" />
              <div className="track-info">
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
              </div>
              <a 
                href={track.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="spotify-link"
              >
                Listen
              </a>
              <button onClick={() => handleAddToPlaylist(track)} className="add-button">
                Add
              </button>
            </li>
          ))}
        </ul>
      </main>

      <button
        onClick={() => navigate(`/playroom?room_name=${roomName}`)}
        className="back-button"
      >
        🔙
      </button>
    </div>
  );
}

export default SearchMusic;