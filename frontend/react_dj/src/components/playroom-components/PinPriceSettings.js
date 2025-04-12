import React, { useState, useEffect } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { API_URL } from '../../config';
import '../../styles/PinPriceSettings.css';

const PinPriceSettings = ({ roomName, isHost }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [pinPrice, setPinPrice] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Fetch current pin price when component mounts
  useEffect(() => {
    if (roomName) {
      fetchPinPrice();
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

  const handleSavePinPrice = async () => {
    if (!isHost) return;
    
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);
      
      // Validate price
      const priceNum = parseInt(pinPrice, 10);
      if (isNaN(priceNum) || priceNum < 1) {
        setError('Price must be at least 1 coin');
        setIsSaving(false);
        return;
      }
      
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication required');
        setIsSaving(false);
        return;
      }
      
      const response = await fetch(`${API_URL}/api/coins/set-pin-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          room_name: roomName,
          price: priceNum
        })
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save pin price');
      }
  
      const data = await response.json();
      setSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      setError(err.message || 'Failed to save pin price');
      console.error('Error saving pin price:', err);
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
          <h4>Pin Price Settings</h4>
          <p className="settings-description">
            Set the price for guests to pin songs to the top of the playlist
          </p>
          <div className="price-input-container">
            <label htmlFor="pin-price">Price (coins):</label>
            <input
              id="pin-price"
              type="number"
              min="1"
              value={pinPrice}
              onChange={(e) => setPinPrice(e.target.value)}
              disabled={isSaving}
            />
          </div>
          {error && <p className="settings-error">{error}</p>}
          {success && <p className="settings-success">Price updated successfully!</p>}
          <button
            className="save-settings"
            onClick={handleSavePinPrice}
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
