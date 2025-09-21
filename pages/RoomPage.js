import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import io from 'socket.io-client'
import { extractVideoId } from '../utils/roomUtils'
import '../styles/RoomPage.css'

const RoomPage = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [userName, setUserName] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(1)
  const playerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const [player, setPlayer] = useState(null)
  const [currentVideoId, setCurrentVideoId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [isUserAction, setIsUserAction] = useState(false)

  useEffect(() => {
    const newSocket = io('http://localhost:3000')
    setSocket(newSocket)
    const defaultName = `User${Math.floor(Math.random() * 1000)}`
    setUserName(defaultName)
    newSocket.emit('joinRoom', roomId)
    setIsConnected(true)

    newSocket.on('connect', () => {
      console.log('Connected:', newSocket.id)
    })

    newSocket.on('roomJoined', (data) => {
      if (data.isHost) {
        setIsHost(true)
      }
    })

    newSocket.on('recentMessages', (recentMessages) => {
      setMessages(recentMessages)
    })

    newSocket.on('currentVideo', (videoId) => {
      if (videoId) {
        setCurrentVideoId(videoId)
        if (player) {
          player.loadVideoById(videoId)
          setTimeout(() => {
            newSocket.emit('requestSync')
          }, 2000)
        }
      }
    })

    newSocket.on('chatMessage', (message) => {
      setMessages(prev => [...prev, message])
    })

    newSocket.on('videoChange', (videoId) => {
      if (videoId && player) {
        player.loadVideoById(videoId)
        setCurrentVideoId(videoId)
      } else if (videoId) {
        setCurrentVideoId(videoId)
      }
    })

    newSocket.on('hostPlay', (data) => {
      if (player && !isUserAction) {
        if (data && typeof data.time === 'number') {
          player.seekTo(data.time, true)
        }
        player.playVideo()
      }
    })

    newSocket.on('hostPause', (data) => {
      if (player && !isUserAction) {
        if (data && typeof data.time === 'number') {
          player.seekTo(data.time, true)
        }
        player.pauseVideo()
      }
    })

    newSocket.on('seek', (time) => {
      if (player && !isUserAction) {
        player.seekTo(time, true)
      }
    })

    newSocket.on('sync', (data) => {
      if (player && !isUserAction) {
        const { time, isPlaying } = data
        player.seekTo(time, true)
        if (isPlaying) {
          player.playVideo()
        } else {
          player.pauseVideo()
        }
      }
    })

    newSocket.on('requestSync', () => {
      if (player && currentVideoId) {
        const currentTime = player.getCurrentTime()
        const isPlaying = player.getPlayerState() === window.YT.PlayerState.PLAYING
        newSocket.emit('syncResponse', {
          time: currentTime,
          isPlaying: isPlaying
        })
      }
    })

    newSocket.on('syncResponse', (data) => {
      if (player && !isUserAction && data) {
        const { time, isPlaying } = data
        player.seekTo(time, true)
        if (isPlaying) {
          player.playVideo()
        } else {
          player.pauseVideo()
        }
      }
    })

    newSocket.on('syncBroadcast', (data) => {
      if (player && !isUserAction && data) {
        const currentTime = player.getCurrentTime()
        const timeDiff = Math.abs(currentTime - data.time)
        if (timeDiff > 2) {
          player.seekTo(data.time, true)
          if (data.isPlaying && player.getPlayerState() !== window.YT.PlayerState.PLAYING) {
            player.playVideo()
          } else if (!data.isPlaying && player.getPlayerState() === window.YT.PlayerState.PLAYING) {
            player.pauseVideo()
          }
        }
      }
    })

    newSocket.on('hostChanged', (data) => {
      if (data.newHost === newSocket.id) {
        setIsHost(true)
      } else {
        setIsHost(false)
      }
    })

    newSocket.on('userCount', (count) => {
      setOnlineUsers(count)
    })

    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
    }

    window.onYouTubeIframeAPIReady = () => {
      const ytPlayer = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        events: {
          onReady: (event) => {
            setPlayer(event.target)
            newSocket.emit('requestCurrentVideo')
            if (currentVideoId) {
              event.target.loadVideoById(currentVideoId)
              setTimeout(() => {
                newSocket.emit('requestSync')
              }, 2000)
            }
          },
          onStateChange: (event) => {
            if (!isHost) return
            setIsUserAction(true)
            if (event.data === window.YT.PlayerState.PLAYING) {
              const currentTime = event.target.getCurrentTime()
              newSocket.emit('hostPlay', { time: currentTime })
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              const currentTime = event.target.getCurrentTime()
              newSocket.emit('hostPause', { time: currentTime })
            }
            setTimeout(() => setIsUserAction(false), 500)
          }
        }
      })
    }

    return () => {
      newSocket.close()
    }
  }, [roomId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (player && currentVideoId) {
      player.loadVideoById(currentVideoId)
    }
  }, [player, currentVideoId])

  useEffect(() => {
    if (!player || !socket || !currentVideoId) return
    const syncInterval = setInterval(() => {
      if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
        const currentTime = player.getCurrentTime()
        socket.emit('syncBroadcast', {
          time: currentTime,
          isPlaying: true
        })
      }
    }, 5000)
    return () => clearInterval(syncInterval)
  }, [player, socket, currentVideoId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = () => {
    if (newMessage.trim() && socket) {
      const messageData = {
        user: userName,
        message: newMessage.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      socket.emit('chatMessage', messageData)
      setMessages(prev => [...prev, messageData])
      setNewMessage('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  const handleLoadVideo = () => {
    const videoId = extractVideoId(videoUrl)
    if (videoId && player && socket) {
      player.loadVideoById(videoId)
      setCurrentVideoId(videoId)
      socket.emit('videoChange', videoId)
      setVideoUrl('')
    } else {
      alert('Please enter a valid YouTube URL')
    }
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="logo" onClick={handleGoHome}>WatchTogether</div>
        <div className="room-info">
          <h2>Room Code: {roomId}</h2>
          {isHost && <div style={{color: '#ff6b6b', fontSize: '14px', marginTop: '5px'}}>🎮 You are the host - You control playback</div>}
          {!isHost && <div style={{color: '#888', fontSize: '14px', marginTop: '5px'}}>👥 Guest - Host controls playback</div>}
        </div>
        <nav>
          <ul>
            <li><a href="#" onClick={handleGoHome}>Home</a></li>
            <li><a href="#">About</a></li>
          </ul>
        </nav>
      </header>

      <div className="room-container">
        <div className="video-section">
          <div className="video-player">
            <div id="youtube-player"></div>
          </div>
          <div className="video-controls">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste YouTube video link here"
              className="video-url-input"
            />
            <button onClick={handleLoadVideo} className="load-button">Load</button>
          </div>
        </div>

        <div className="chat-section">
          <div className="chat-header">
            <h3>Live Chat</h3>
            <div className="user-count">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"/>
              </svg>
              <span>{onlineUsers}</span>
            </div>
          </div>

          <div className="messages-container">
            {messages.map((msg, index) => (
              <div key={index} className="message">
                <span className="message-user">{msg.user}</span>
                <span className="message-time">{msg.timestamp}</span>
                <div className="message-text">{msg.message}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="message-input-container">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send message"
              className="message-input"
            />
            <button onClick={handleSendMessage} className="send-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoomPage
