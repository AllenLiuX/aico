// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { UserProvider } from './contexts/UserContext';
import Header from './components/Header';
import Homepage from './components/Homepage';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import PlaylistGenerator from './components/PlaylistGenerator';
import PlayRoom from './components/PlayRoom';
import AboutUs from './components/AboutUs';
import SearchMusic from './components/SearchMusic';
import Profile from './components/Profile';
import Explore from './components/Explore';

import './styles/App.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <UserProvider>
        <Router>
          <div className="App">
            <Header />
            <main className="pt-16"> {/* Added padding-top to account for fixed header */}
              <Routes>
                <Route exact path="/" element={<Navigate to="/about" />} />
                <Route path="/homepage" element={<Homepage />} />
                <Route path="/create_room" element={<CreateRoom />} />
                <Route path="/join_room" element={<JoinRoom />} />
                <Route path="/playlist" element={<PlaylistGenerator />} />
                <Route path="/playroom" element={<PlayRoom />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/search_music" element={<SearchMusic />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/explore" element={<Explore />} />
              </Routes>
            </main>
          </div>
        </Router>
      </UserProvider>
    </GoogleOAuthProvider>
  );
}

export default App;