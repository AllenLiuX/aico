import React, { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player";

const MusicPlayer = ({ songs = [], initialSong = 0 }) => {
  const [currentSong, setCurrentSong] = useState(initialSong);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const playerRef = useRef(null);

  // Update current song if initialSong prop changes
  useEffect(() => {
    setCurrentSong(initialSong);
  }, [initialSong]);

  // Effect to auto-play when song changes
  useEffect(() => {
    if (songs.length > 0) {
      setPlaying(true);
    }
  }, [currentSong, songs.length]);

  const togglePlay = () => setPlaying(!playing);

  const nextSong = () => {
    if (songs.length === 0) return;
    setCurrentSong((prev) => (prev + 1) % songs.length);
    setPlayed(0);
  };

  const prevSong = () => {
    if (songs.length === 0) return;
    setCurrentSong((prev) => (prev - 1 + songs.length) % songs.length);
    setPlayed(0);
  };

  const handleSeek = (event) => {
    const newValue = parseFloat(event.target.value);
    setPlayed(newValue);
    playerRef.current?.seekTo(newValue / 100, "fraction");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleVolumeChange = (event) => {
    setVolume(parseFloat(event.target.value));
  };

  const handleDuration = (duration) => {
    setDuration(duration);
  };

  const handleProgress = ({ played, playedSeconds }) => {
    setPlayed(played * 100);
  };

  // If no songs, show placeholder
  if (!songs || songs.length === 0) {
    return (
      <div className="w-80 mx-auto p-5 bg-gray-900 text-white shadow-lg rounded-lg flex flex-col items-center">
        <p className="text-center">No songs available</p>
      </div>
    );
  }

  const currentSongData = songs[currentSong];

  return (
    <div className="w-80 mx-auto p-5 bg-gray-900 text-white shadow-lg rounded-lg flex flex-col items-center">
      {/* Album Cover */}
      <img
        src={currentSongData.img}
        alt={currentSongData.title}
        className="w-48 h-48 object-cover rounded-xl shadow-md mb-4"
      />

      {/* Song Info */}
      <h2 className="text-lg font-bold">{currentSongData.title}</h2>
      <p className="text-gray-400 text-sm">{currentSongData.artist}</p>

      {/* React Player (Hidden) */}
      <ReactPlayer
        ref={playerRef}
        url={currentSongData.url}
        playing={playing}
        volume={volume}
        onProgress={handleProgress}
        onDuration={handleDuration}
        onEnded={nextSong}
        width="0"
        height="0"
        config={{
          youtube: {
            playerVars: { 
              autoplay: 1,
              controls: 0,
              disablekb: 1
            }
          }
        }}
      />

      {/* Progress Bar */}
      <div className="w-full mt-4 mb-2">
        <input
          type="range"
          min="0"
          max="100"
          value={played}
          onChange={handleSeek}
          className="w-full mb-1"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{formatTime((played * duration) / 100)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-4 mt-2">
        <button onClick={prevSong} className="px-3 py-2 bg-gray-700 rounded-lg">
          ⏮️
        </button>
        <button onClick={togglePlay} className="px-4 py-3 bg-blue-500 rounded-full">
          {playing ? "⏸️" : "▶️"}
        </button>
        <button onClick={nextSong} className="px-3 py-2 bg-gray-700 rounded-lg">
          ⏭️
        </button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center w-full mt-3">
        <span className="mr-2">🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default MusicPlayer;

// import React, { useState, useRef } from "react";
// import ReactPlayer from "react-player";

// const songs = [
//   {
//     url: "https://music.youtube.com/watch?v=fJ9rUzIMcZQ",
//     title: "Bohemian Rhapsody",
//     artist: "Queen",
//     img: "https://i.scdn.co/image/ab67616d0000b2730b66bb2555bb1d5a0d0c42d7",
//   },
//   {
//     url: "https://music.youtube.com/watch?v=kJQP7kiw5Fk",
//     title: "Despacito",
//     artist: "Luis Fonsi ft. Daddy Yankee",
//     img: "https://i.scdn.co/image/ab67616d0000b2738476829db92bc9f6c30b7e84",
//   },
//   {
//     url: "https://music.youtube.com/watch?v=3JZ4pnNtyxQ",
//     title: "Shape of You",
//     artist: "Ed Sheeran",
//     img: "https://i.scdn.co/image/ab67616d0000b2739f0ae11e3d3e9944a6e4df30",
//   },
// ];

// const MusicPlayer = () => {
//   const [currentSong, setCurrentSong] = useState(0);
//   const [playing, setPlaying] = useState(false);
//   const [played, setPlayed] = useState(0);
//   const playerRef = useRef<ReactPlayer | null>(null);

//   const togglePlay = () => setPlaying(!playing);

//   const nextSong = () => {
//     setCurrentSong((prev) => (prev + 1) % songs.length);
//     setPlaying(true);
//   };

//   const prevSong = () => {
//     setCurrentSong((prev) => (prev - 1 + songs.length) % songs.length);
//     setPlaying(true);
//   };

//   const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const newValue = parseFloat(event.target.value);
//     setPlayed(newValue);
//     playerRef.current?.seekTo(newValue / 100, "fraction");
//   };

//   return (
//     <div className="w-80 mx-auto p-5 bg-gray-900 text-white shadow-lg rounded-lg flex flex-col items-center">
//       {/* Album Cover */}
//       <img
//         src={songs[currentSong].img}
//         alt={songs[currentSong].title}
//         className="w-48 h-48 object-cover rounded-xl shadow-md mb-4"
//       />

//       {/* Song Info */}
//       <h2 className="text-lg font-bold">{songs[currentSong].title}</h2>
//       <p className="text-gray-400 text-sm">{songs[currentSong].artist}</p>

//       {/* React Player (Hidden) */}
//       <ReactPlayer
//         ref={playerRef}
//         url={songs[currentSong].url}
//         playing={playing}
//         onProgress={({ played }) => setPlayed(played * 100)}
//         onEnded={nextSong}
//         width="0"
//         height="0"
//       />

//       {/* Progress Bar */}
//       <input
//         type="range"
//         min="0"
//         max="100"
//         value={played}
//         onChange={handleSeek}
//         className="w-full mt-4 mb-2"
//       />

//       {/* Controls */}
//       <div className="flex justify-center items-center gap-4 mt-2">
//         <button onClick={prevSong} className="px-3 py-2 bg-gray-700 rounded-lg">
//           ⏮️
//         </button>
//         <button onClick={togglePlay} className="px-3 py-2 bg-blue-500 rounded-lg">
//           {playing ? "⏸️" : "▶️"}
//         </button>
//         <button onClick={nextSong} className="px-3 py-2 bg-gray-700 rounded-lg">
//           ⏭️
//         </button>
//       </div>
//     </div>
//   );
// };

// export default MusicPlayer;
