// components/Header.js
import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="main-header">
      <nav>
        <ul>
          <li><Link to="/homepage">Home</Link></li>
          <li><Link to="/about">About Us</Link></li>
          {/* <li><Link to="/search_music">Search</Link></li> */}
        </ul>
      </nav>
    </header>
  );
}

export default Header;