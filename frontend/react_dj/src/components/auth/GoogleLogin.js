import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

const GoogleAuthComponent = () => {
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    try {
      // Send the token to your backend
      const response = await fetch('/api/auth/google/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Store the token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('userProfile', JSON.stringify({
          name: data.name,
          email: data.email,
          picture: data.picture
        }));
        
        // Redirect to home page or dashboard
        navigate('/dashboard');
      } else {
        console.error('Login failed:', data.error);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleError = () => {
    console.error('Login Failed');
  };

  return (
    <div className="google-login-button">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap
      />
    </div>
  );
};

export default GoogleAuthComponent;
