// import logo from './logo.svg';
// import './App.css';

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.js</code> and save to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;


// App.js
import React, { useState } from 'react';
import PreferenceForm from './components/PreferenceForm';
import Playlist from './components/Playlist';
import ShareButton from './components/ShareButton';
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
      {/* <h1>AICO AI DJ Playlist Generator</h1> */}
      <header>
        <h1>ALCO Room</h1>
        <ShareButton />
      </header>
      <PreferenceForm onSubmit={generatePlaylist} />
      {playlist && <Playlist tracks={playlist} />}
    </div>
  );
}

export default App;