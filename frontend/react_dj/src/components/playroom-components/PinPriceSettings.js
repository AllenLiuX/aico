import React, { useState, useEffect } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { API_URL } from '../../config';
import '../../styles/PinPriceSettings.css';

const PinPriceSettings = ({ roomName, isHost }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [pinPrice, setPinPrice] = useState(10);
  const [requestPrice, setRequestPrice] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Fetch current prices when component mounts
  useEffect(() => {
    if (roomName) {
      fetchPinPrice();
      fetchRequestPrice();
    }
  }, [roomName]);

  const fetchPinPrice = async () => {
    try {
      const response = await fetch(`${API_URL}/api/coins/get-pin-price?room_name=${roomName}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch pin price');
      }
      
      const data = await response.json();
      setPinPrice(data.price);
    } catch (err) {
      console.error('Error fetching pin price:', err);
      // Use default price if fetch fails
      setPinPrice(10);
    }
  };

  const fetchRequestPrice = async () => {
    try {
      const response = await fetch(`${API_URL}/api/coins/get-request-price?room_name=${roomName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch request price');
      }
      const data = await response.json();
      setRequestPrice(data.price);
    } catch (err) {
      console.error('Error fetching request price:', err);
      setRequestPrice(30);
    }
  };

  const handleSavePrices = async () => {
    if (!isHost) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      // Validate prices
      const pinPriceNum = parseInt(pinPrice, 10);
      const requestPriceNum = parseInt(requestPrice, 10);
      if (isNaN(pinPriceNum) || pinPriceNum < 1 || isNaN(requestPriceNum) || requestPriceNum < 1) {
        setError('Prices must be at least 1 coin');
        setIsSaving(false);
        return;
      }

      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setIsSaving(false);
        return;
      }

      // Save pin price
      const respPin = await fetch(`${API_URL}/api/coins/set-pin-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ room_name: roomName, price: pinPriceNum })
      });
      if (!respPin.ok) {
        const errData = await respPin.json();
        throw new Error(errData.error || 'Failed to save pin price');
      }

      // Save request price
      const respReq = await fetch(`${API_URL}/api/coins/set-request-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ room_name: roomName, price: requestPriceNum })
      });
      if (!respReq.ok) {
        const errData = await respReq.json();
        throw new Error(errData.error || 'Failed to save request price');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save prices');
      console.error('Error saving prices:', err);
    } finally {
      setIsSaving(false);
    }
  };


  // Only show for host
  if (!isHost) return null;

  return (
    <div className="pin-price-settings">
      {!showSettings ? (
        <button 
          className="settings-toggle-button"
          onClick={() => setShowSettings(true)}
          title="Pin Price Settings"
        >
          <Settings size={18} />
          Pin Settings
        </button>
      ) : (
        <div className="pin-settings-panel">
          <button 
            className="close-settings"
            onClick={() => setShowSettings(false)}
          >
            <X size={18} />
          </button>
          <h4>Price Settings</h4>
          <p className="settings-description">
            Set the prices that guests will pay for pinning or requesting songs
          </p>
          <div className="price-input-container">
            <label htmlFor="pin-price">Pin Price (coins):</label>
            <input
              id="pin-price"
              type="number"
              min="1"
              value={pinPrice}
              onChange={(e) => setPinPrice(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="price-input-container">
            <label htmlFor="request-price">Request Price (coins):</label>
            <input
              id="request-price"
              type="number"
              min="1"
              value={requestPrice}
              onChange={(e) => setRequestPrice(e.target.value)}
              disabled={isSaving}
            />
          </div>
          {error && <p className="settings-error">{error}</p>}
          {success && <p className="settings-success">Price updated successfully!</p>}
          <button
            className="save-settings"
            onClick={handleSavePrices}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : (
              <>
                <Save size={16} />
                Save
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PinPriceSettings;
