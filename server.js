const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// PostgreSQL connection
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:ZokvN2OwM5HD@ep-autumn-scene-a1izhr9p.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

// Create table if not exists
pool.query(`
  CREATE TABLE IF NOT EXISTS user_typing_data (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    wpm INTEGER,
    errors INTEGER,
    incorrect_words INTEGER,
    correct_words INTEGER,
    backspace_count INTEGER,
    accuracy FLOAT,
    typed_words INTEGER,
    test_duration INTEGER,
    test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Error creating table:', err));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected', socket.id);

  socket.on('startTest', (data) => {
    console.log('Received startTest event with data:', data);
    if (data && data.paragraph && data.duration) {
      console.log('Emitting testStarted event with data:', data);
      io.emit('testStarted', {
        paragraph: data.paragraph,
        duration: data.duration
      });
    } else {
      console.error('Invalid data received from admin:', data);
      socket.emit('error', { message: 'Invalid test data' });
    }
  });

socket.on('testCompleted', async (data) => {
  console.log('Test completed:', data);
  try {
    await pool.query(
      `INSERT INTO user_typing_data 
       (username, wpm, errors, incorrect_words, correct_words, backspace_count, accuracy, typed_words, test_duration) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [data.username, data.wpm, data.errors, data.incorrectWords, data.correctWords, 
       data.backspaceCount, data.accuracy, data.typedWords, data.testDuration]
    );
    console.log('User data saved to database');
  } catch (err) {
    console.error('Error saving user data:', err);
  }
});

  socket.on('disconnect', () => {
    console.log('User disconnected', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Error handling for the server
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});