// ProfileDropdown.js
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut, BarChart2, ShoppingCart } from 'lucide-react';
import { UserContext } from '../contexts/UserContext';
import '../styles/ProfileDropdown.css';

const ProfileDropdown = ({ onLogout }) => {
  const { user } = useContext(UserContext);
  
  console.log('ProfileDropdown user:', user);
  
  return (
    <div className="profile-dropdown">
      <Link to="/profile" className="dropdown-item">
        <User size={18} />
        <span>Profile</span>
      </Link>
      
      <Link to="/store" className="dropdown-item">
        <ShoppingCart size={18} />
        <span>Store</span>
      </Link>
      
      {user && user.is_admin && (
        <Link to="/admin" className="dropdown-item">
          <BarChart2 size={18} />
          <span>Admin Dashboard</span>
        </Link>
      )}
      
      <button onClick={onLogout} className="dropdown-item">
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </div>
  );
};

export default ProfileDropdown;