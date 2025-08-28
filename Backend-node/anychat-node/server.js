// importing required modules and dependencies
const express = require('express'); //handles routing
const http = require('http'); //built in Node module for creating HTTP server
const { Server } = require('socket.io'); 
const path = require('path'); //for handling file paths
const { v4: uuidv4 } = require('uuid'); //for generating unique IDs

// setting up Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../Frontend')));

// Parse URL-encoded GET query parameters
app.use(express.urlencoded({ extended: true }));

let waitingUsers = [];
const userRooms = {}; 

//------------------------------ROUTES------------------------------//

// Serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../Frontend/landing.html'));
});

// Serve chat page
app.get('/chat', (req, res) => {
  const nickname = req.query.nickname;
  if (!nickname) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../../Frontend/chat.html'));
});

// Socket.IO logic
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join', (data) => {
    const { nickname } = data;

    if (!waitingUsers.length) {
      waitingUsers.push({ sid: socket.id, nickname });
      socket.emit('message', '⏳ Waiting for another user...');
    } else {
      const other = waitingUsers.pop();
      const roomId = uuidv4().slice(0, 8);

      socket.join(roomId);
      io.sockets.sockets.get(other.sid).join(roomId);

      userRooms[socket.id] = roomId;
      userRooms[other.sid] = roomId;

      io.to(roomId).emit('message', `✅ Chat started between ${nickname} and ${other.nickname}`);
      io.to(roomId).emit('chat_started');
    }
  });

  socket.on('message', (data) => {
    const room = userRooms[socket.id];
    if (room) {
      io.to(room).emit('message', data);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const room = userRooms[socket.id];
    if (room) {
      io.to(room).emit('message', '⚠️ User disconnected');
    }
    waitingUsers = waitingUsers.filter(u => u.sid !== socket.id);
    delete userRooms[socket.id];
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
