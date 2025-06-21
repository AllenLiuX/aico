import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, X, RefreshCw } from 'lucide-react';
import '../../styles/AIModerationSettings.css';

/**
 * AI Moderation Settings Component
 * Allows hosts to configure AI-based song moderation
 */
const AIModerationSettings = ({ 
  roomName, 
  isHost, 
  moderationEnabled, 
  fetchAiModerationSettings,
  updateAiModerationSettings,
  fetchAiModerationHints,
  onClose,
  onAiModerationUpdate
}) => {
  // State for AI moderation settings
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loadingHints, setLoadingHints] = useState(false);
  
  // Settings state
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState('');
  const [strictnessLevel, setStrictnessLevel] = useState('medium');
  
  // Hints state
  const [hints, setHints] = useState(null);

  // Fetch AI moderation settings when component mounts - only once
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    let hasLoaded = false; // Flag to prevent multiple API calls
    
    const getSettings = async () => {
      // Prevent duplicate API calls
      if (!isHost || !moderationEnabled || hasLoaded) return;
      
      try {
        setLoading(true);
        setError(null);
        hasLoaded = true; // Mark as loaded to prevent duplicate calls
        
        const settings = await fetchAiModerationSettings(roomName);
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        if (settings) {
          setEnabled(settings.enabled || false);
          setDescription(settings.description || '');
          setStrictnessLevel(settings.strictness_level || 'medium');
        } else {
          // Set defaults but don't auto-generate hints
          setEnabled(true);
          setStrictnessLevel('medium');
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching AI moderation settings:', err);
          setError('Failed to load AI moderation settings');
          hasLoaded = false; // Reset flag on error to allow retry
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    getSettings();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [roomName, isHost, moderationEnabled]); // Remove fetchAiModerationSettings from dependencies

  // Handle save settings
  const handleSaveSettings = async () => {
    if (!isHost || !moderationEnabled) return;
    
    try {
      setSaving(true);
      setError(null);
      
      await updateAiModerationSettings(
        roomName,
        enabled,
        description,
        strictnessLevel
      );
      
      if (onAiModerationUpdate) {
        onAiModerationUpdate({
          enabled,
          description,
          strictnessLevel
        });
      }
    } catch (err) {
      console.error('Error saving AI moderation settings:', err);
      setError('Failed to save AI moderation settings');
    } finally {
      setSaving(false);
    }
  };

  // Handle generate hints
  const handleGenerateHints = async () => {
    if (!isHost || !moderationEnabled) return;
    
    try {
      setLoadingHints(true);
      setError(null);
      
      const hintsData = await fetchAiModerationHints(roomName);
      
      // Check if we got valid data back
      if (hintsData && hintsData.suggested_criteria) {
        setHints({
          suggested_criteria: [hintsData.suggested_criteria],
          examples: hintsData.examples || [],
          suggested_genres: hintsData.suggested_genres || [],
          suggested_moods: hintsData.suggested_moods || [],
          suggested_energy_levels: hintsData.suggested_energy_levels || []
        });
        
        // If we don't have a description yet and we get hints, use the suggested criteria as default
        if (!description || description.trim() === '') {
          setDescription(hintsData.suggested_criteria);
        }
      } else {
        console.error('Invalid hints data format:', hintsData);
        setError('Received invalid hints data format');
      }
    } catch (err) {
      console.error('Error generating AI moderation hints:', err);
      setError('Failed to generate AI moderation hints');
    } finally {
      setLoadingHints(false);
    }
  };

  // Handle using a hint as description
  const handleUseHint = (hint) => {
    setDescription(hint);
  };

  // Strictness level options
  const strictnessOptions = [
    { value: 'strict', label: 'Strict', description: 'Only allow songs that closely match criteria' },
    { value: 'medium', label: 'Medium', description: 'Allow songs that reasonably match criteria' },
    { value: 'easy', label: 'Easy', description: 'Allow most songs unless they clearly violate criteria' }
  ];

  if (!isHost || !moderationEnabled) {
    return null;
  }

  return (
    <div className="ai-moderation-settings">
      <div className="ai-moderation-header">
        <h2>AI Moderation Settings</h2>
        <button className="close-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      
      {loading ? (
        <div className="loading-indicator">
          <RefreshCw className="spinning" size={24} />
          <span>Loading settings...</span>
        </div>
      ) : (
        <>
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="setting-group">
            <div className="toggle-container">
              <label>Enable AI Moderation</label>
              <div 
                className={`toggle ${enabled ? 'enabled' : ''}`}
                onClick={() => setEnabled(!enabled)}
              >
                <div className="toggle-handle"></div>
              </div>
            </div>
            <p className="setting-description">
              When enabled, AI will automatically approve or reject songs based on your criteria
            </p>
          </div>
          
          <div className={`setting-group ${!enabled ? 'disabled' : ''}`}>
            <label>Moderation Criteria</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what songs should be allowed in your playlist..."
              disabled={!enabled}
              rows={4}
            ></textarea>
            <p className="setting-description">
              Describe the types of songs you want to allow (genres, moods, themes, etc.)
            </p>
            
            <div className="hints-section">
              <button 
                className="generate-hints-button"
                onClick={handleGenerateHints}
                disabled={!enabled || loadingHints}
              >
                {loadingHints ? (
                  <>
                    <RefreshCw className="spinning" size={16} />
                    <span>Generating suggestions...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    <span>Generate suggestions</span>
                  </>
                )}
              </button>
              
              {hints && (
                <div className="hints-container">
                  <h4>Suggested Criteria</h4>
                  <div className="hint-chips">
                    {hints.examples && hints.examples.map((hint, index) => (
                      <div 
                        key={`example-${index}`} 
                        className="hint-chip"
                        onClick={() => handleUseHint(hint)}
                      >
                        {hint}
                      </div>
                    ))}
                  </div>
                  
                  {/* Example Descriptions section removed to avoid duplication */}
                </div>
              )}
            </div>
          </div>
          
          <div className={`setting-group ${!enabled ? 'disabled' : ''}`}>
            <label>Strictness Level</label>
            <div className="strictness-options">
              {strictnessOptions.map((option) => (
                <div 
                  key={option.value}
                  className={`strictness-option ${strictnessLevel === option.value ? 'selected' : ''}`}
                  onClick={() => enabled && setStrictnessLevel(option.value)}
                >
                  <div className="option-header">
                    <span className="option-radio">
                      {strictnessLevel === option.value && <Check size={12} />}
                    </span>
                    <span className="option-label">{option.label}</span>
                  </div>
                  <p className="option-description">{option.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="action-buttons">
            <button 
              className="cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="save-button"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw className="spinning" size={16} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIModerationSettings;
