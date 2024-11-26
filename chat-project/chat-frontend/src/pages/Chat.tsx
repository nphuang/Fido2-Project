import React, { useEffect, useState } from 'react';
import { connectWebSocket, sendWebSocketMessage, closeWebSocket } from '../utils/socket';
import '../styles/Chat.css';
import { useUser } from '../context/UserContext';

interface Message {
  sender: string;
  content: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { username } = useUser(); // 從全域 Context 獲取當前用戶名

  useEffect(() => {
    connectWebSocket('ws://localhost:4000', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => closeWebSocket();
  }, []);

  const sendMessage = () => {
    if (input.trim()) {
      sendWebSocketMessage({ sender: username, content: input });
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <h1>Chat Room</h1>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="chat-message">
            <b>{msg.sender}:</b> {msg.content}
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <input
          type="text"
          placeholder="輸入訊息"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="chat-input"
        />
        <button onClick={sendMessage} className="chat-send-button">
          發送
        </button>
      </div>
    </div>
  );
};

export default Chat;
