// src/SpotifyPlayer.js
import React, { useEffect, useState } from 'react';

const SpotifyPlayer = () => {
    const [player, setPlayer] = useState(null);
    const [currentTrack, setCurrentTrack] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('spotify_token'); // Get the token from local storage
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const newPlayer = new window.Spotify.Player({
                name: 'Web Playback SDK',
                getOAuthToken: cb => { cb(token); },
                volume: 0.5
            });

            setPlayer(newPlayer);

            newPlayer.addListener('player_state_changed', state => {
                if (state) {
                    setCurrentTrack(state.track_window.current_track);
                }
            });

            newPlayer.connect();
        };
    }, []);

    return (
        <div>
            {currentTrack && (
                <div>
                    <h2>Now Playing: {currentTrack.name}</h2>
                    <h3>By: {currentTrack.artists.map(artist => artist.name).join(', ')}</h3>
                    <img src={currentTrack.album.images[0].url} alt={currentTrack.name} />
                </div>
            )}
        </div>
    );
};

export default SpotifyPlayer;