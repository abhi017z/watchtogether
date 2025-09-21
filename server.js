const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
})

app.use(cors())
app.use(express.static("public"))

if (require('fs').existsSync(path.join(__dirname, "client/build"))) {
  app.use(express.static(path.join(__dirname, "client/build")))
}

const rooms = new Map()

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id)

  socket.on("joinRoom", (room) => {
    socket.join(room)
    socket.room = room
    if (!rooms.has(room)) {
      rooms.set(room, {
        users: new Set(),
        currentVideo: null,
        messages: [],
        currentTime: 0,
        isPlaying: false,
        lastUpdate: Date.now(),
        hostSocket: null
      })
    }
    const roomData = rooms.get(room)
    roomData.users.add(socket.id)
    if (!roomData.hostSocket || !roomData.users.has(roomData.hostSocket)) {
      roomData.hostSocket = socket.id
    }
    console.log(`User ${socket.id} joined room: ${room}`)
    const userCount = roomData.users.size
    io.to(room).emit("userCount", userCount)
    socket.emit("recentMessages", roomData.messages.slice(-20))
    if (roomData.currentVideo) {
      socket.emit("currentVideo", roomData.currentVideo)
      setTimeout(() => {
        if (roomData.currentTime > 0) {
          const timeDiff = (Date.now() - roomData.lastUpdate) / 1000
          const currentTime = roomData.isPlaying ? roomData.currentTime + timeDiff : roomData.currentTime
          socket.emit("sync", {
            time: Math.max(0, currentTime),
            isPlaying: roomData.isPlaying
          })
        }
      }, 1500)
    }
  })

  socket.on("requestCurrentVideo", () => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      if (roomData.currentVideo) {
        socket.emit("currentVideo", roomData.currentVideo)
        setTimeout(() => {
          if (roomData.currentTime > 0) {
            const timeDiff = (Date.now() - roomData.lastUpdate) / 1000
            const currentTime = roomData.isPlaying ? roomData.currentTime + timeDiff : roomData.currentTime
            socket.emit("sync", {
              time: Math.max(0, currentTime),
              isPlaying: roomData.isPlaying
            })
          }
        }, 1500)
      }
    }
  })

  socket.on("requestCurrentState", () => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      if (roomData.currentVideo && roomData.currentTime > 0) {
        const timeDiff = (Date.now() - roomData.lastUpdate) / 1000
        const currentTime = roomData.isPlaying ? roomData.currentTime + timeDiff : roomData.currentTime
        socket.emit("sync", {
          time: Math.max(0, currentTime),
          isPlaying: roomData.isPlaying
        })
      }
    }
  })

  socket.on("chatMessage", (messageData) => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      roomData.messages.push(messageData)
      if (roomData.messages.length > 100) {
        roomData.messages = roomData.messages.slice(-100)
      }
      socket.to(socket.room).emit("chatMessage", messageData)
    }
  })

  socket.on("videoChange", (videoId) => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      roomData.currentVideo = videoId
      roomData.currentTime = 0
      roomData.isPlaying = false
      roomData.lastUpdate = Date.now()
      socket.to(socket.room).emit("videoChange", videoId)
    }
  })

  socket.on("play", (data) => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      if (data && typeof data.time === 'number') {
        roomData.currentTime = data.time
      }
      roomData.isPlaying = true
      roomData.lastUpdate = Date.now()
      console.log(`Play event: Room ${socket.room}, Time: ${roomData.currentTime}`)
      socket.to(socket.room).emit("sync", {
        time: roomData.currentTime,
        isPlaying: true
      })
    }
  })

  socket.on("pause", (data) => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      if (data && typeof data.time === 'number') {
        roomData.currentTime = data.time
      }
      roomData.isPlaying = false
      roomData.lastUpdate = Date.now()
      console.log(`Pause event: Room ${socket.room}, Time: ${roomData.currentTime}`)
      socket.to(socket.room).emit("sync", {
        time: roomData.currentTime,
        isPlaying: false
      })
    }
  })

  socket.on("seek", (time) => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      roomData.currentTime = time
      roomData.lastUpdate = Date.now()
      console.log(`Seek event: Room ${socket.room}, Time: ${time}`)
      socket.to(socket.room).emit("seek", time)
    }
  })

  socket.on("requestSync", (currentTime) => {
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      if (socket.id === roomData.hostSocket) {
        roomData.currentTime = currentTime
        roomData.lastUpdate = Date.now()
        socket.to(socket.room).emit("sync", {
          time: currentTime,
          isPlaying: roomData.isPlaying
        })
      }
    }
  })

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id)
    if (socket.room && rooms.has(socket.room)) {
      const roomData = rooms.get(socket.room)
      roomData.users.delete(socket.id)
      if (roomData.hostSocket === socket.id && roomData.users.size > 0) {
        roomData.hostSocket = roomData.users.values().next().value
      }
      const userCount = roomData.users.size
      if (userCount > 0) {
        io.to(socket.room).emit("userCount", userCount)
      } else {
        setTimeout(() => {
          if (rooms.has(socket.room) && rooms.get(socket.room).users.size === 0) {
            rooms.delete(socket.room)
            console.log(`Room ${socket.room} cleaned up`)
          }
        }, 60000)
      }
    }
  })
})

app.get("*", (req, res) => {
  const buildPath = path.join(__dirname, "client/build", "index.html")
  if (require('fs').existsSync(buildPath)) {
    res.sendFile(buildPath)
  } else {
    res.status(404).send('Development mode: React dev server should run on port 3001')
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log("React dev server should run on http://localhost:3001")
})
