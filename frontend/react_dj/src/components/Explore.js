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
  const loader = useRef(null);
  const PAGE_SIZE = 12;

  const fetchRooms = async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      const response = await fetch(
        `http://13.56.253.58:5000/api/explore/rooms?page=${page}&limit=${PAGE_SIZE}`
      );

      if (!response.ok) throw new Error('Failed to fetch rooms');

      const data = await response.json();
      const newRooms = data.rooms;

      setRooms(prevRooms => [...prevRooms, ...newRooms]);
      setHasMore(newRooms.length === PAGE_SIZE);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore) {
      fetchRooms();
    }
  }, [hasMore]);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '20px',
      threshold: 1.0
    };

    const observer = new IntersectionObserver(handleObserver, options);
    if (loader.current) {
      observer.observe(loader.current);
    }

    return () => {
      if (loader.current) {
        observer.unobserve(loader.current);
      }
    };
  }, [handleObserver]);

  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <div className="explore-container">
      <div className="explore-header">
        <h1>Explore Rooms</h1>
        <p>Discover music rooms created by the community</p>
      </div>

      <div className="rooms-grid">
        {rooms.map((room, index) => (
          <RoomCard key={`${room.name}-${index}`} room={room} />
        ))}
      </div>

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading more rooms...</p>
        </div>
      )}

      <div ref={loader} className="loader-element" />
    </div>
  );
}

export default Explore;