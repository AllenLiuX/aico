import React, { createContext, useState, useEffect, useContext } from 'react';
import { API_URL } from '../config';

export const UserContext = createContext(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setToken(storedToken);
        
        // Verify token is still valid with backend
        fetch(`${API_URL}/api/auth/user`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        })
        .then(response => {
          if (!response.ok) {
            // Token is invalid, log the user out
            logout();
            throw new Error('Invalid token');
          }
          return response.json();
        })
        .then(data => {
          if (data.success && data.user) {
            // Update user data from server
            updateUser({
              ...userData,
              ...data.user
            });
          }
        })
        .catch(error => {
          console.error('Error verifying token:', error);
        });
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (userData, authToken) => {
    console.log('Logging in with user data:', userData);
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const updateCoins = (newCoinsAmount) => {
    if (user) {
      const updatedUser = {
        ...user,
        coins: newCoinsAmount
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const addCoins = (coinsToAdd) => {
    if (user) {
      const currentCoins = user.coins || 0;
      updateCoins(currentCoins + coinsToAdd);
    }
    return 0;
  };

  const useCoins = async (coinsAmount, featureName) => {
    if (!user || !token) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!coinsAmount || coinsAmount <= 0) {
      return { success: false, error: 'Invalid coin amount' };
    }

    try {
      const response = await fetch(`${API_URL}/api/payments/use-coins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coins: coinsAmount,
          feature: featureName
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { 
          success: false, 
          error: data.error || 'Failed to use coins',
          currentCoins: data.current_coins,
          requiredCoins: data.required_coins
        };
      }

      // Update user coins in context
      updateCoins(data.remaining_coins);
      
      return { 
        success: true, 
        remainingCoins: data.remaining_coins,
        coinsUsed: data.coins_used
      };
    } catch (error) {
      console.error('Error using coins:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <UserContext.Provider value={{ user, login, updateUser, updateCoins, addCoins, useCoins, logout, token }}>
      {children}
    </UserContext.Provider>
  );
};
