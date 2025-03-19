// Explore.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Calendar } from 'lucide-react';
import Avatar from './common/Avatar';
import '../styles/Explore.css';
import { API_URL } from '../config';

const RoomCard = ({ room }) => {
  const navigate = useNavigate();

  const handleRoomClick = () => {
    navigate(`/playroom?room_name=${room.name}&is_host=False`);
  };

  // Format the created_at date if available
  const formatCreationDate = (dateString) => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
    }
  };

  const creationDate = room.host?.created_at ? formatCreationDate(room.host.created_at) : null;

  return (
    <div className="room-card" onClick={handleRoomClick}>
      <div className="room-image">
        {/* <img
          src={room.cover_image || '/api/placeholder/300/200'}
          alt={room.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/api/placeholder/300/200';
          }}
        /> */}
        <img
          src={room.cover_image || '/api/placeholder/300/200'}
          alt={room.name}
          onError={(e) => {
            e.target.onerror = null; // Important: prevent further error callbacks
            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="300" height="200" fill="%232c2c2c"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="%23666"%3ENo Image%3C/text%3E%3C/svg%3E';
            // Using inline SVG data URL instead of calling the API again
          }}
        />
        <div className="song-count">
          <Music size={14} />
          <span>{room.song_count} songs</span>
        </div>
      </div>
      <div className="room-content">
        <h3>{room.name}</h3>
        <p>{room.introduction}</p>
        <div className="room-tags">
          {room.genre && <span className="tag genre-tag">{room.genre}</span>}
          {room.occasion && <span className="tag occasion-tag">{room.occasion}</span>}
        </div>
        {room.host && (
          <div className="host-info">
            <Avatar 
              src={room.host.avatar}
              username={room.host.username}
              size={24}
            />
            <span>{room.host.username}</span>
            
            {/* Display creation date if available */}
            {creationDate && (
              <div className="room-creation-date">
                <Calendar size={12} />
                <span>{creationDate}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// In Explore.js
function Explore() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [allRoomsLoaded, setAllRoomsLoaded] = useState(false);
    const loader = useRef(null);
    const initialFetchDone = useRef(false);
    const PAGE_SIZE = 12;
  
    const fetchRooms = async (pageNum) => {
      if (loading || !hasMore) return;
  
      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/api/explore/rooms?page=${pageNum}&limit=${PAGE_SIZE}`
        );
  
        if (!response.ok) throw new Error('Failed to fetch rooms');
  
        const data = await response.json();
        const newRooms = data.rooms;
  
        // Filter out duplicates
        const uniqueNewRooms = newRooms.filter(
          newRoom => !rooms.some(existingRoom => existingRoom.name === newRoom.name)
        );
  
        if (uniqueNewRooms.length > 0) {
          setRooms(prevRooms => [...prevRooms, ...uniqueNewRooms]);
          setPage(pageNum + 1);
        }
  
        // Check if all rooms are loaded
        if (newRooms.length < PAGE_SIZE || uniqueNewRooms.length === 0) {
          setHasMore(false);
          setAllRoomsLoaded(true);
        }
  
      } catch (error) {
        console.error('Error fetching rooms:', error);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };
  
    const handleObserver = useCallback((entries) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        fetchRooms(page);
      }
    }, [hasMore, loading, page]);
  
    useEffect(() => {
      // Initial fetch only once
      if (!initialFetchDone.current) {
        fetchRooms(1);
        initialFetchDone.current = true;
      }
    }, []);
  
    useEffect(() => {
      const currentLoader = loader.current;
      const options = {
        root: null,
        rootMargin: '20px',
        threshold: 0.1
      };
  
      const observer = new IntersectionObserver(handleObserver, options);
      
      if (currentLoader && hasMore && !loading) {
        observer.observe(currentLoader);
      }
  
      return () => {
        if (currentLoader) {
          observer.unobserve(currentLoader);
        }
      };
    }, [handleObserver, hasMore, loading]);
  
    return (
      <div className="explore-container">
        <div className="explore-header">
          <h1>Explore Rooms</h1>
          <p>Discover music rooms created by the community</p>
        </div>
  
        <div className="rooms-grid">
          {rooms.map((room) => (
            <RoomCard key={room.name} room={room} />
          ))}
        </div>
  
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading more rooms...</p>
          </div>
        )}
  
        {allRoomsLoaded && rooms.length > 0 && (
          <div className="end-message">
            You've seen all available rooms!
          </div>
        )}
  
        {hasMore && !loading && (
          <div ref={loader} className="loader-element" />
        )}
      </div>
    );
  }

export default Explore;