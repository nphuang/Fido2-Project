const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// 模擬用戶數據
const users = new Map();

// 登錄 API
router.post('/login', (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ success: false, message: '用戶名不可為空' });
  }

  // 模擬生成用戶 token
  const token = uuidv4();
  users.set(token, { username });

  res.json({ success: true, token });
});

// 驗證用戶 token API
router.get('/validate', (req, res) => {
  const { token } = req.headers;

  if (!token || !users.has(token)) {
    return res.status(401).json({ success: false, message: '無效的 token' });
  }

  res.json({ success: true, username: users.get(token).username });
});

module.exports = router;
