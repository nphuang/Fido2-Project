import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import router from './routes/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://localhost:5173';

app.use(bodyParser.json());
app.use(cors({ origin: CORS_ORIGIN }));

// 使用路由
app.use(router);

// HTTP -> HTTPS 重定向
const httpsServer = https.createServer(
  {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || './localhost-key.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || 'localhost.pem'),
  },
  app
);

app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${HTTPS_PORT}`);
});


//////////////////////////////////////////////////////////////////////////////////////////
// WebSocket 設置
const io = new Server(httpsServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

const onlineUsers = new Set();

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    onlineUsers.add(username);
    io.emit('onlineUsers', Array.from(onlineUsers));
  });

  socket.on('leave', (username) => {
    onlineUsers.delete(username);
    io.emit('onlineUsers', Array.from(onlineUsers));
  });

  socket.on('sendMessage', ({ username, message, timestamp }) => {
    io.emit('message', { username, text: message, timestamp });
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('userTyping', username);
  });
  socket.on('stopTyping', (username) => {
    socket.broadcast.emit('userStopTyping', username);
  });

  socket.on('disconnect', () => {
    onlineUsers.forEach((user) => {
      if (socket.id === user.socketId) {
        onlineUsers.delete(user.username);
        io.emit('onlineUsers', Array.from(onlineUsers));
      }
    });
  });
});

app.get('/', (req, res) => {
  res.send('Server is running');
});