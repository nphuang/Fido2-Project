import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Chat.css';
import io from 'socket.io-client';
const socket = io('https://localhost:443');
import axios from 'axios';
import { startAuthentication } from '@simplewebauthn/browser';

interface Message {
  username: string;
  text: string;
  timestamp: string;
  special?: boolean;
}

const Chat: React.FC = () => {
  const { username, logout } = useUser();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [error, setError] = useState(''); // 新增錯誤訊息狀態


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
    socket.on('userTyping', (username: string) => {
      setTypingUsers((prev) => [...new Set([...prev, username])]);
    });
  
    socket.on('userStopTyping', (username: string) => {
      setTypingUsers((prev) => prev.filter((user) => user !== username));
    });
  
    return () => {
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, []);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = () => {
    logout();
    navigate('/'); // 登出後重定向至登入頁面
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      setError(''); // 清除錯誤訊息
      const timestamp = new Date().toLocaleTimeString();
      socket.emit('sendMessage', { username, message, timestamp });
      setMessage('');
    }
  };

  const handleSendSpecialMessage = async () => {
    if (message.trim()) {
      try {
        setError(''); // 清除錯誤訊息        
        // 向後端請求 WebAuthn 驗證選項
        const optionsResp = await axios.get('https://localhost:443/generate-authentication-options', {
          params: { username },
        });
        const options = optionsResp.data;
  
        // 啟動 WebAuthn 驗證
        const assertionResponse = await startAuthentication({ optionsJSON: options });
  
        // 向後端傳送驗證結果
        const verificationResp = await axios.post('https://localhost:443/verify-authentication', {
          username,
          response: assertionResponse,
        });
        const { verified } = verificationResp.data;
  
        if (verified) {
          const timestamp = new Date().toLocaleTimeString();
          socket.emit('sendMessage', { username, message: `${message}`, timestamp, special: true });
          setMessage('');
        } else {
          setError('WebAuthn 驗證失敗');
        }
      } catch (err) {
        console.error(err);
        setError('WebAuthn 驗證過程中發生錯誤');
      }
    }
  };  
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (e.target.value.trim()) {
      socket.emit('typing', username);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', username);
      }, 1000); // 1 秒後觸發停止輸入
    } else {
      socket.emit('stopTyping', username);
    }
  };
  

  const handleStopTyping = () => {
    socket.emit('stopTyping', username);
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
          <div key={index} className={`message ${msg.special ? 'special-message' : ''}`}>
            <span className="message-user">{msg.username}</span>
            <span className="message-text">{msg.text}</span>
            <span className="message-timestamp">{msg.timestamp}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="typing-status">
        {typingUsers.length > 0 && (
          <p>{typingUsers.join(', ')} 正在輸入...</p>
        )}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={message}
          onChange={handleTyping}
          onKeyDown={handleKeyPress}
          onBlur={handleStopTyping}
          placeholder="輸入消息"
        />
        <button onClick={handleSendMessage}>發送</button>
        <button onClick={handleSendSpecialMessage}>發送驗證訊息</button>
      </div>
      {error && <p className="error-message">{error}</p>} {/* 顯示錯誤訊息 */}
    </div>
  );
};

export default Chat;