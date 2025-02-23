// AuthModal.js
import React, { useState } from 'react';
import { Mail, Lock, Github } from 'lucide-react';
import '../styles/AuthModal.css';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (email && password) {
      const user = {
        id: '1',
        email,
        name: email.split('@')[0],
        avatar: '/api/placeholder/40/40'
      };
      localStorage.setItem('user', JSON.stringify(user));
      window.location.reload();
    } else {
      setError('Please fill in all fields');
    }
  };

  const handleGoogleLogin = () => {
    const user = {
      id: '1',
      email: 'user@gmail.com',
      name: 'Test User',
      avatar: '/api/placeholder/40/40'
    };
    localStorage.setItem('user', JSON.stringify(user));
    window.location.reload();
  };

  const handleGithubLogin = () => {
    const user = {
      id: '2',
      email: 'user@github.com',
      name: 'Github User',
      avatar: '/api/placeholder/40/40'
    };
    localStorage.setItem('user', JSON.stringify(user));
    window.location.reload();
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <h2>{isLogin ? 'Login' : 'Register'}</h2>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          <button type="submit" className="submit-button">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="auth-divider">
          <span>Or continue with</span>
        </div>

        <div className="social-buttons">
          <button
            onClick={handleGoogleLogin}
            className="social-button"
          >
            <Mail size={20} />
            <span>Google</span>
          </button>
          <button
            onClick={handleGithubLogin}
            className="social-button"
          >
            <Github size={20} />
            <span>Github</span>
          </button>
        </div>

        <div className="auth-switch">
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="close-button"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AuthModal;