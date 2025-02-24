// Explore.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music } from 'lucide-react';
import '../styles/Explore.css';

const RoomCard = ({ room }) => {
  const navigate = useNavigate();

  const handleRoomClick = () => {
    navigate(`/playroom?room_name=${room.name}&is_host=False`);
  };

  return (
    <div className="room-card" onClick={handleRoomClick}>
      <div className="room-image">
        <img
          src={room.cover_image || '/api/placeholder/300/200'}
          alt={room.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/api/placeholder/300/200';
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
            <img 
              src={room.host.avatar} 
              alt={room.host.username}
              className="host-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/api/placeholder/24/24';
              }}
            />
            <span>{room.host.username}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function Explore() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [allRoomsShown, setAllRoomsShown] = useState(false);
    const loader = useRef(null);
    const PAGE_SIZE = 12;
  
    const fetchRooms = useCallback(async () => {
      if (loading || !hasMore) return;
  
      try {
        setLoading(true);
        console.log('Fetching page:', page); // Debug log
  
        const response = await fetch(
          `http://13.56.253.58:5000/api/explore/rooms?page=${page}&limit=${PAGE_SIZE}`
        );
  
        if (!response.ok) throw new Error('Failed to fetch rooms');
  
        const data = await response.json();
        console.log('Received data:', data); // Debug log
  
        const newRooms = data.rooms;
  
        // Filter out duplicates
        const uniqueNewRooms = newRooms.filter(
          newRoom => !rooms.some(existingRoom => existingRoom.name === newRoom.name)
        );
  
        if (uniqueNewRooms.length > 0) {
          setRooms(prevRooms => [...prevRooms, ...uniqueNewRooms]);
          setPage(prev => prev + 1);
        }
  
        // Check if we've shown all rooms
        if (rooms.length + uniqueNewRooms.length >= data.total) {
          setHasMore(false);
          setAllRoomsShown(true);
        } else {
          setHasMore(uniqueNewRooms.length > 0);
        }
  
      } catch (error) {
        console.error('Error fetching rooms:', error);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }, [page, loading, hasMore, rooms]); // Add all dependencies
  
    const handleObserver = useCallback((entries) => {
      const target = entries[0];
      console.log('Intersection:', target.isIntersecting); // Debug log
      if (target.isIntersecting && hasMore && !loading) {
        fetchRooms();
      }
    }, [hasMore, loading, fetchRooms]);
  
    useEffect(() => {
      const currentLoader = loader.current;
      const options = {
        root: null,
        rootMargin: '100px', // Increased margin to trigger earlier
        threshold: 0.1 // Reduced threshold to trigger more easily
      };
  
      const observer = new IntersectionObserver(handleObserver, options);
      
      if (currentLoader) {
        observer.observe(currentLoader);
      }
  
      return () => {
        if (currentLoader) {
          observer.unobserve(currentLoader);
        }
      };
    }, [handleObserver]);
  
    useEffect(() => {
      fetchRooms();
    }, []); // Initial fetch
  
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
  
        {allRoomsShown ? (
          <div className="end-message">
            You've seen all available rooms!
          </div>
        ) : (
          <div 
            ref={loader}
            className="loader-element"
            style={{ 
              height: '20px',
              margin: '20px 0',
              visibility: hasMore ? 'visible' : 'hidden'
            }}
          />
        )}
      </div>
    );
  }

export default Explore;