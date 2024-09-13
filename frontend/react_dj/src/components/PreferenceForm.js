// components/PreferenceForm.js
import React, { useState } from 'react';

const GENRE_OPTIONS = [
  'Pop', 'Rock', 'Hip Hop', 'Jazz', 'Classical', 'Electronic', 'R&B', 'Country', 'Other'
];

const OCCASION_OPTIONS = [
  'Party', 'Workout', 'Relaxation', 'Study', 'Commute', 'Dinner', 'Other'
];

function PreferenceForm({ onSubmit }) {
  const [prompt, setPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genre, setGenre] = useState('');
  const [customGenre, setCustomGenre] = useState('');
  const [occasion, setOccasion] = useState('');
  const [customOccasion, setCustomOccasion] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      prompt,
      genre: genre === 'Other' ? customGenre : genre,
      occasion: occasion === 'Other' ? customOccasion : occasion
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="prompt">Describe the music you want:</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="E.g., Upbeat pop songs for a summer road trip"
          required
        />
      </div>
      
      <button 
        type="button" 
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="toggle-advanced"
      >
        {showAdvanced ? 'Hide Advanced Search' : 'Show Advanced Search'}
      </button>

      {showAdvanced && (
        <div className="advanced-search">
          <div>
            <label htmlFor="genre">Music Genre:</label>
            <select
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="">Select a genre</option>
              {GENRE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {genre === 'Other' && (
              <input
                type="text"
                value={customGenre}
                onChange={(e) => setCustomGenre(e.target.value)}
                placeholder="Enter custom genre"
              />
            )}
          </div>
          <div>
            <label htmlFor="occasion">Occasion:</label>
            <select
              id="occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            >
              <option value="">Select an occasion</option>
              {OCCASION_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {occasion === 'Other' && (
              <input
                type="text"
                value={customOccasion}
                onChange={(e) => setCustomOccasion(e.target.value)}
                placeholder="Enter custom occasion"
              />
            )}
          </div>
        </div>
      )}

      <button type="submit">Generate Playlist</button>
    </form>
  );
}

export default PreferenceForm;