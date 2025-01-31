const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Dropbox } = require('dropbox');
const { Server } = require('socket.io');
const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

// Initialize Dropbox
const dropbox = new Dropbox({
  accessToken: 'sl.u.AFgg9rCW-chIu5IoDmXNDmucpO9P3S53Xtq_8gM0XpVqvXibGwEGgIpFx5KRIrZLJx0JRmVqixzJP66m9TzgdSrmv4V78ZVyKdVRqs6d9Tasyj_60PhaGfEarp_Qwt8UaneZlWabS9PPRTEpEX9MjyNK2ofnAG5Ku4q5Da75-MeLYtTlk2jyolEC9FvC2yRMMzi8Xg_2k7jhWIelL8jQ3eQ9uDuqCVFy21xMLybqws4a4VyDGLPIcZ8WEP619CRe4Y3krKvDiPuWXpyHGIAEkFG_HxigwhEsUWLahjKyIBFcFnmKuAze3F43rYvU0u8pudLP73nKoRPi7TC_hpPqOrofnNfUozcyerI2Mjan79tEGPSInsl8Lm89HRezp32KTacFiOSz7RW4zW2LJaQ07Z-0sxPCGId8Fh4FJ5XTWQok3v1b8AZlRDJ5T5tIhFtH932yHCRgk-FXqk_Nzt7j_tIt9u9p2V9cfjuuQpeKvnl-wg9Fa8qTzTJYXoY3MFheKi6H7LOKCGyIZfxap5FP0FXVvWJ41etUCOJlkun4CebuLSgmGKKPFgsYVEds4tZ0NLtKTQZIurngfC9eE--tVO6gJBh920wsu139qL9JXRWhEh9sM5kaWMPdI68umSD-WHJWB-AKXceM_ift1fvfx6DX_sT66NOxd_qyNoyokHUsTiK2O5HEB2vlIP-OeyfHamC2F0hed7QtpkWG9d3xy_NYKhOOPdykJos9PN8HWHzYwBYHv8mobf2-CSzkBrU-FnGnh3yg-jfZv47IZ4iBHxs2WcOHGqyowdQgBjpkL2YC-Pz6Og4Xeop0qZMQ3pKxwMFlwfrsFRdE82w9S0dbzGyxwWvs7ekUPuexgo14TEKtavTgHkH_pKZqT11Kk_P3DWgpV2w3oK_Qy6aUUgRtkXPLDFijLNN6hqfq7NIT6ohIMLX1esDgDd-GMoKGt1KY4m-hNthSH2lIttjyulGKkWbMwFtpEhGJ8vhkM_YqqjTyzcraqJKRSpLESOs3713JekjGrU4b_J_MqPHTVs22PVVzTTzJf4_hjXWoArMbKOyKr8zwglRAs3IuBF_CodKhNuyWLf6QS2EcelBNuXylxtRJsiGRQ90Fguug7-Lrrkfl4ICLeV9UmTssE3VzjHXJcqa-5f-bgiLKK9ek9OES1T5oVqSmRq1Mb1d_FZ86SqhU3FXXu9R2i4M5qDc20oo8ys9eXvnhHACOJNTOndzsRU8PY3ZHf-J763d17jiqHIZUnqUZ8vEbsGxa3Bx2NOoPt1Y2QzDYU0Z0P2Yj74LTZOpF09TTkMHCPqjPo2Enj3C-GvqnYMvu12wFFBlDec5MMtqZ9z1cokNVKELVaJwvCH6vBpZCr8Q0O2jyJrb1La5rxY8TthWFsNnUWKnpn5iOMnne-UI0p1e0kzXf6b2h7UKvfNf43wEltIuU95h-TuTO8Q',
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
server.listen(process.env.PORT, () => console.log(`RUNNING ON PORT ${process.env.PORT}`));
