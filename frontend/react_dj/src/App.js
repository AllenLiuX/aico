// import logo from './logo.svg';
// import './App.css';

// // App.js
// import React, { useState } from 'react';
// // import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import PreferenceForm from './components/PreferenceForm';
// import Playlist from './components/Playlist';
// import ShareButton from './components/ShareButton';

// import Homepage from './components/Homepage';
// import CreateRoom from './components/CreateRoom';
// import JoinRoom from './components/JoinRoom';
// import PlaylistGenerator from './components/PlaylistGenerator';
// import './App.css';

// function App() {
//   return (
//     <Router>
//       <div className="App">
//         <Routes>
//           <Route path="/homepage" element={<Homepage />} />
//           <Route path="/create_room" element={<CreateRoom />} />
//           <Route path="/join_room" element={<JoinRoom />} />
//           <Route path="/app" element={<PlaylistGenerator />} />
//         </Routes>
//       </div>
//     </Router>
//   );
// }

// export default App;


// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Homepage from './components/Homepage';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import PlaylistGenerator from './components/PlaylistGenerator';
import PlayRoom from './components/PlayRoom';
import AboutUs from './components/AboutUs';
import SearchMusic from './components/SearchMusic';
import SimplePlayerPage from './components/SimplePlayerPage'; // Import the new simple player page

import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <main>
          <Routes>
            <Route exact path="/" render={() => <Navigate to="/homepage" />} />
            <Route path="/homepage" element={<Homepage />} />
            <Route path="/create_room" element={<CreateRoom />} />
            <Route path="/join_room" element={<JoinRoom />} />
            <Route path="/playlist" element={<PlaylistGenerator />} />
            <Route path="/playroom" element={<PlayRoom />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/search_music" element={<SearchMusic />} />
            <Route path="/player" element={<SimplePlayerPage />} /> {/* Add the new route */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;