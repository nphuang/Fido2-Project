import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Chat.css';
import io from 'socket.io-client';

const Chat: React.FC = () => {
  const { username, logout } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/'); // 登出後重定向至登入頁面
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
    </div>
  );
};

export default Chat;
