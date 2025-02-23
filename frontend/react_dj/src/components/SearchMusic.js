// SearchMusic.js
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Music, User } from 'lucide-react';
import '../styles/SearchMusic.css';

function SearchMusic() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchType, setSearchType] = useState('artist');
  
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      const response = await fetch(`http://13.56.253.58:5000/api/search-music?query=${encodeURIComponent(searchQuery)}&search_type=${searchType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }
      const data = await response.json();
      setSearchResults(data.tracks || []);
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
      <button
        onClick={() => navigate(`/playroom?room_name=${roomName}`)}
        className="back-button"
      >
        <ArrowLeft size={18} />
        Back to Room
      </button>

      <div className="search-header">
        <h1>Search Music</h1>
      </div>

      <div className="search-form-container">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by ${searchType}`}
              className="search-input"
            />
          </div>
          <button 
            type="submit" 
            className="search-button" 
            disabled={isLoading || !searchQuery.trim()}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="search-toggle">
          <button
            className={`toggle-option ${searchType === 'artist' ? 'active' : ''}`}
            onClick={() => setSearchType('artist')}
          >
            <User size={18} />
            Artist
          </button>
          <button
            className={`toggle-option ${searchType === 'song' ? 'active' : ''}`}
            onClick={() => setSearchType('song')}
          >
            <Music size={18} />
            Song
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isLoading ? (
        <div className="loading-state">Searching for music...</div>
      ) : searchResults.length > 0 ? (
        <div className="search-results">
          {searchResults.map((track) => (
            <div key={track.song_id} className="track-card">
              <img 
                src={track.cover_img_url} 
                alt={track.title}
                className="track-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/api/placeholder/300/300';
                }}
              />
              <div className="track-content">
                <h3 className="track-title">{track.title}</h3>
                <p className="track-artist">{track.artist}</p>
                <div className="track-actions">
                  <a
                    href={track.song_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-button listen-button"
                  >
                    Listen
                  </a>
                  <button
                    onClick={() => handleAddToPlaylist(track)}
                    className="action-button add-button"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : searchQuery && !isLoading ? (
        <div className="loading-state">No results found</div>
      ) : null}
    </div>
  );
}

export default SearchMusic;