import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios'; // Import axios

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      const userData = JSON.parse(storedUser);
      
      // Ensure we have the latest user data, including admin status
      axios.get('/api/auth/user', {
        headers: { Authorization: storedToken }
      })
      .then(response => {
        if (response.data.success) {
          const updatedUser = {
            ...userData,
            ...response.data.user,
            is_admin: true // Always set admin to true for testing
          };
          console.log('User data updated:', updatedUser);
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      })
      .catch(error => {
        console.error('Error refreshing user data:', error);
        setUser(userData);
      });
    }
  }, []);

  const login = async (userData, token) => {
    // Always set admin to true for testing
    userData.is_admin = true;
    
    console.log('Logging in with user data:', userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <UserContext.Provider value={{ user, login, updateUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
