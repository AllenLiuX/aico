import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function SearchMusic() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room');

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://13.56.253.58:5000/api/search-music?query=${encodeURIComponent(searchQuery)}`);
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

  return (
    <div className="search-music">
      <header>
        <h1>Search Music</h1>
      </header>

      <section className="playlist-info">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter song or artist name"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </section>

      {error && <p className="error">{error}</p>}

      <main className="playlist-container">
        <ul className="search-results">
          {searchResults.map((track) => (
            <li key={track.id} className="track-item">
              <div className="track-info">
                <h3>{track.name}</h3>
                <p>{track.artists.map(artist => artist.name).join(', ')}</p>
              </div>
              <button onClick={() => handleAddToPlaylist(track)}>+</button>
            </li>
          ))}
        </ul>
      </main>

      <button onClick={() => navigate(`/playroom?room_name=${roomName}`)}>
        Back to Playroom
      </button>
    </div>
  );
}

export default SearchMusic;
