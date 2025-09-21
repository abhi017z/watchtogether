import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRoomId } from '../utils/roomUtils';
import '../styles/HomePage.css';

const HomePage = () => {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    const trimmedCode = roomCode.trim().toUpperCase();
    console.log('Joining room with code:', trimmedCode);
    if (trimmedCode) {
      navigate(`/room/${trimmedCode}`);
    } else {
      setError('Please enter a valid room code');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  return (
    <div className="homepage">
      <header className="header">
        <div className="logo">WatchTogether</div>
        <nav>
          <ul>
            <li><a href="#">Home</a></li>
            <li><a href="#">About</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </nav>
      </header>
      
      <main className="main-content">
        <h1>Watch Videos Together, Anywhere</h1>
        <p>Enjoy synchronized video watching with friends and family no matter where they are. Share reactions, chat, and create memories together in real-time.</p>
        
        <div className="buttons">
          <button className="join-button" onClick={handleCreateRoom}>
            Create Room
          </button>
          <button className="join-button" onClick={() => setShowJoinModal(true)}>
            Join Room
          </button>
        </div>
        
        <div className="features">
          <div className="feature">
            <i>🎬</i>
            <h3>Sync Playback</h3>
            <p>Perfect synchronization across all devices.</p>
          </div>
          <div className="feature">
            <i>💬</i>
            <h3>Live Chat</h3>
            <p>Share reactions and comments in real-time.</p>
          </div>
          <div className="feature">
            <i>🔒</i>
            <h3>Private Rooms</h3>
            <p>Create password-protected watching sessions.</p>
          </div>
        </div>
      </main>

      {showJoinModal && (
        <div className="modal" onClick={(e) => e.target.className === 'modal' && setShowJoinModal(false)}>
          <div className="modal-content">
            <h2>Join a Watch Room</h2>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="Enter room code"
              maxLength="6"
              className={error ? 'error' : ''}
            />
            {error && <div className="error-message">{error}</div>}
            <div className="modal-buttons">
              <button 
                className="modal-button cancel-button" 
                onClick={() => {
                  setShowJoinModal(false);
                  setRoomCode('');
                  setError('');
                }}
              >
                Cancel
              </button>
              <button className="modal-button join-room-button" onClick={handleJoinRoom}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
