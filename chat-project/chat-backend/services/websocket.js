const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const messagesPath = path.join(__dirname, '../db/messages.json');
let clients = new Map(); // 保存已連接的 WebSocket 客戶端

// 初始化 WebSocket 服務
function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('新客戶端已連接');

    // 客戶端加入時
    const clientId = Date.now();
    clients.set(clientId, ws);

    // 發送歷史消息
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
    ws.send(JSON.stringify({ type: 'history', data: messages }));

    // 處理收到的消息
    ws.on('message', (message) => {
      const parsedMessage = JSON.parse(message);

      // 保存消息
      const newMessage = {
        sender: parsedMessage.sender,
        content: parsedMessage.content,
        timestamp: new Date().toISOString(),
      };
      messages.push(newMessage);
      fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));

      // 廣播消息
      broadcast(JSON.stringify({ type: 'message', data: newMessage }), clientId);
    });

    // 客戶端斷開時
    ws.on('close', () => {
      clients.delete(clientId);
      console.log('客戶端已斷開');
    });
  });
}

// 廣播消息給其他客戶端
function broadcast(message, senderId) {
  for (const [clientId, client] of clients.entries()) {
    if (clientId !== senderId && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

module.exports = { setupWebSocket };
