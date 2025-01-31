const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Dropbox } = require('dropbox');
const { Server } = require('socket.io');
const http = require('http');

// Initialize Dropbox
const dropbox = new Dropbox({
  accessToken: 'YOUR_ACCESS_TOKEN',
  fetch: require('node-fetch'),
});

// Configure Multer (File Upload)
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    callback(null, tmpDir);
  },
  filename: (req, file, callback) => {
    callback(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Route
app.get('/', (req, res) => {
  res.send('READY FOR UPLOADING');
});

// File Upload Route
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded.');

  const filePath = path.join(process.cwd(), 'tmp', file.filename);

  try {
    // Upload file to Dropbox
    const response = await dropbox.filesUpload({
      path: `/${file.filename}`,
      contents: fs.readFileSync(filePath),
      mode: 'add',
    });

    // Create a shareable link
    const sharedLink = await dropbox.sharingCreateSharedLinkWithSettings({
      path: response.result.path_lower,
    });

    const fileUrl = sharedLink.result.url.replace('?dl=0', '?raw=1');

    // Delete local file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.status(200).send(`File uploaded successfully. Accessible at: ${fileUrl}`);
  } catch (error) {
    console.log(error);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO Connection
io.on('connect', (socket) => {
  console.log('YOU ARE NOW CONNECTED');

  socket.on('message', (msg) => {
    console.log('Message received:', msg);
    io.emit('message', msg); // Broadcast message to all clients
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start Server
server.listen(3000, () => console.log("RUNNING ON PORT 3000"));
