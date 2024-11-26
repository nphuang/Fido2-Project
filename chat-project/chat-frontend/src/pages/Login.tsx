import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';
import { useUser } from '../context/UserContext';
import { startAuthentication } from '@simplewebauthn/browser';

const Login: React.FC = () => {
  const [inputUsername, setInputUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // 加載狀態
  const navigate = useNavigate();
  const { setUsername } = useUser();

  const handleLogin = async () => {
    if (!inputUsername.trim()) {
      setError('用戶名不可為空');
      return;
    }

    try {
      setLoading(true); // 設置加載狀態
      setError('');

      // 向後端請求 WebAuthn 驗證選項
      const optionsResp = await axios.get('/generate-authentication-options', {
        params: { username: inputUsername },
      });
      const options = optionsResp.data;

      // 啟動 WebAuthn 驗證
      const assertionResponse = await startAuthentication(options);

      // 向後端傳送驗證結果
      const verificationResp = await axios.post('/verify-authentication', assertionResponse);
      const { verified, token } = verificationResp.data;

      if (verified) {
        localStorage.setItem('token', token); // 儲存登入 token
        setUsername(inputUsername); // 更新全域用戶名
        navigate('/chat'); // 跳轉到聊天頁面
      } else {
        setError('登入失敗，請重試');
      }
    } catch (err) {
      console.error(err);
      setError('登入過程中發生錯誤，請稍後再試。');
    } finally {
      setLoading(false); // 結束加載狀態
    }
  };

  return (
    <div className="login-container">
      <h1>聊天室 Demo</h1>
      <p className="login-instruction">輸入您的用戶名以登入</p>
      <input
        type="text"
        placeholder="輸入用戶名"
        value={inputUsername}
        onChange={(e) => setInputUsername(e.target.value)}
        className="login-input"
      />
      <button
        onClick={handleLogin}
        className="login-button"
        disabled={loading} // 防止多次點擊
      >
        {loading ? '登入中...' : '登入'}
      </button>
      {error && <p className="login-error">{error}</p>}
      <p className="register-link">
        沒有帳號？ <Link to="/register">立即註冊</Link>
      </p>
    </div>
  );
};

export default Login;
