// // components/Playlist.js
// import React from 'react';

// function Playlist({ tracks }) {
//   return (
//     <div className="playlist">
//       <h2>Your Playlist</h2>
//       <ul>
//         {tracks.map((track, index) => (
//           <li key={index}>
//             {track.title} - {track.artist}
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

// export default Playlist;

// components/Playlist.js
import React from 'react';

function Playlist({ tracks }) {
  return (
    <div className="playlist">
      <h2>Your Playlist</h2>
      <ul>
        {tracks.map((track, index) => (
          <li key={index}>
            <span className="track-info">{track.title} - {track.artist}</span>
            <a 
              href={track.song_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="spotify-button"
            >
              Listen on YouTube
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Playlist;