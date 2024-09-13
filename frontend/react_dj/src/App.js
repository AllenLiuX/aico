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
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Homepage from './components/Homepage';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import PlaylistGenerator from './components/PlaylistGenerator';
import PlayRoom from './components/Playroom';
import AboutUs from './components/AboutUs';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <main>
          <Routes>
            <Route path="/homepage" element={<Homepage />} />
            <Route path="/create_room" element={<CreateRoom />} />
            <Route path="/join_room" element={<JoinRoom />} />
            <Route path="/playlist" element={<PlaylistGenerator />} />
            <Route path="/playroom" element={<PlayRoom />} />
            <Route path="/about" element={<AboutUs />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;