import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import styles from '../styles/changelog.module.css';

const Changelog = () => {
  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState(null);

  useEffect(() => {
    const fetchChangelogs = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/changelogs');
        setChangelogs(response.data.changelogs);
        // Set the latest version as expanded by default
        if (response.data.changelogs && response.data.changelogs.length > 0) {
          setExpandedVersion(response.data.changelogs[0].version);
        }
      } catch (err) {
        console.error('Error fetching changelogs:', err);
        setError('Failed to load changelogs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchChangelogs();
  }, []);

  const toggleVersion = (version) => {
    if (expandedVersion === version) {
      setExpandedVersion(null);
    } else {
      setExpandedVersion(version);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'feature':
        return styles.feature;
      case 'security':
        return styles.security;
      case 'bugfix':
        return styles.bugfix;
      case 'release':
        return styles.release;
      default:
        return styles.other;
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <p>Loading changelogs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.changelogContainer}>
      <h2 className={styles.changelogTitle}>Release History</h2>
      <div className={styles.timeline}>
        {changelogs.map((log, index) => (
          <div key={log.version} className={styles.timelineItem}>
            <div className={styles.timelineDot}></div>
            <div className={styles.timelineContent}>
              <div 
                className={styles.versionHeader} 
                onClick={() => toggleVersion(log.version)}
              >
                <div className={styles.versionInfo}>
                  <h3 className={styles.versionTitle}>
                    v{log.version} - {log.title}
                  </h3>
                  <div className={styles.versionMeta}>
                    <span className={styles.versionDate}>
                      <Clock size={14} />
                      {log.date}
                    </span>
                    <span className={`${styles.versionType} ${getTypeColor(log.type)}`}>
                      <Tag size={14} />
                      {log.type}
                    </span>
                  </div>
                </div>
                <button className={styles.expandButton}>
                  {expandedVersion === log.version ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
              
              {expandedVersion === log.version && (
                <div className={styles.versionDetails}>
                  <p className={styles.versionDescription}>{log.description}</p>
                  <ul className={styles.changesList}>
                    {log.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className={styles.changeItem}>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Changelog;
