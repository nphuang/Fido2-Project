import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Chat.css';
import io from 'socket.io-client';
const socket = io('https://localhost:443'); // 替换为你的服务器地址

interface Message {
  username: string;
  text: string;
  timestamp: string;
}

const Chat: React.FC = () => {
  const { username, logout } = useUser();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!username) {
      navigate('/');
      return;
    }

    socket.emit('join', username);

    socket.on('message', (msg: Message) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    socket.on('onlineUsers', (users: string[]) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.emit('leave', username);
      socket.off('message');
      socket.off('onlineUsers');
    };
  }, [username, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = () => {
    logout();
    navigate('/'); // 登出後重定向至登入頁面
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      const timestamp = new Date().toLocaleTimeString();
      socket.emit('sendMessage', { username, message, timestamp });
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  if (!username) {
    return <p>加載中...</p>;
  }

  return (
    <div className="chat-container">
      <h1>歡迎來到聊天室</h1>
      <p>您好，{username}！</p>
      <button onClick={handleLogout} className="logout-button">
        登出
      </button>
      <div className="online-users">
        <h2>在線用戶</h2>
        <ul>
          {onlineUsers.map((user) => (
            <li key={user}>{user}</li>
          ))}
        </ul>
      </div>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="message">
            <span className="message-user">{msg.username}</span>
            <span className="message-text">{msg.text}</span>
            <span className="message-timestamp">{msg.timestamp}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="輸入消息"
        />
        <button onClick={handleSendMessage}>發送</button>
      </div>
    </div>
  );
};

export default Chat;