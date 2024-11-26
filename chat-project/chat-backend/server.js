const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { setupWebSocket } = require('./services/websocket');
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { initDB } from './db.js';


const app = express();
const PORT = 4000;

// Relying Party 信息
const rpName = 'Chat App Example';
const rpID = 'localhost';
const origin = `http://${rpID}:${PORT}`;


// 中間件設置
app.use(cors());
app.use(bodyParser.json());

// const authRoutes = require('./routes/auth');
// app.use('/auth', authRoutes);

// 啟動 HTTP 伺服器
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// WebSocket 設置
setupWebSocket(server);
