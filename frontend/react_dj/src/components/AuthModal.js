// AuthModal.js
import React, { useState, useEffect } from 'react';
import { Mail, Lock, Github, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import '../styles/AuthModal.css';
import { API_URL, FRONTEND_URL } from '../config';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check for Google authorization code in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleCode = urlParams.get('google_code');
    const authError = urlParams.get('auth_error');
    
    if (googleCode) {
      // Exchange the code for tokens
      exchangeGoogleCodeForToken(googleCode);
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    if (authError) {
      setError(`Google authentication error: ${authError}`);
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);
  
  // Function to exchange Google code for token
  const exchangeGoogleCodeForToken = async (code) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/api/auth/google/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: 'https://aico-music.com/auth/google/callback'
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to exchange Google code for token');
      }
      
      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Refresh page
      window.location.reload();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // const endpoint = isLogin ? 'http://127.0.0.1:5000/api/auth/login' : 'http://127.0.0.1:5000/api/auth/register';
      // const endpoint = isLogin ? 'http://13.56.253.58:5000/api/auth/login' : 'http://13.56.253.58:5000/api/auth/register';
      const endpoint = isLogin ? `${API_URL}/api/auth/login` : `${API_URL}/api/auth/register`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          ...(isLogin ? {} : { email: formData.email })
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Close modal and refresh page
      onClose();
      window.location.reload();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setError('');
      setIsLoading(true);
      
      // Decode the credential to get user info including picture
      const decoded = jwtDecode(credentialResponse.credential);
      console.log("Google login success, decoded info:", decoded);
      
      const googleUserInfo = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture // Google avatar URL
      };
      
      const response = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: credentialResponse.credential,
          redirect_uri: FRONTEND_URL,
          user_info: googleUserInfo
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Google authentication failed');
      }

      const data = await response.json();
      console.log("Backend response:", data);
      
      // Store token and user data with Google avatar
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({
        ...data.user,
        avatar: googleUserInfo.picture // Ensure we use Google's avatar URL
      }));
      
      // Close modal and refresh page
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
  };

  return (
    <div className="auth-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">
        <div className="auth-header">
          <h2>{isLogin ? 'Login' : 'Register'}</h2>
        </div>
        
        {error && (
          <div className="error-message">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleInputChange}
              className="auth-input"
              required
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <Mail className="input-icon" size={20} />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                className="auth-input"
                required
              />
            </div>
          )}

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              className="auth-input"
              required
            />
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="auth-divider">
          <span>Or continue with</span>
        </div>

        <div className="social-buttons">
          <div className="google-login-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              theme="filled_black"
              shape="pill"
              size="large"
              text="continue_with"
              locale="en"
              ux_mode="popup"
            />
          </div>
          {/* <button className="social-button">
            <Github size={20} />
            <span>Github</span>
          </button> */}
        </div>

        <div className="auth-switch">
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="close-button"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AuthModal;