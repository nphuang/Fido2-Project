import React, { useEffect, useState } from 'react';
import { startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import axios from 'axios';
import '../styles/Register.css'; // 添加樣式
import { Link } from 'react-router-dom';


const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // 註冊過程的加載狀態

  // 檢查瀏覽器是否支持 WebAuthn 以及平台認證器的可用性
  useEffect(() => {
    const checkPlatformAuthAvailability = async () => {
      const isAvailable = await platformAuthenticatorIsAvailable();
      if (!isAvailable) {
        setError('當前設備不支持平台認證器');
      }
    };
    checkPlatformAuthAvailability();
  }, []);

  // 手動註冊按鈕點擊處理
  const handleRegister = async () => {
    if (!username.trim()) {
      setError('用戶名不可為空');
      return;
    }

    try {
      setLoading(true); // 設置加載狀態
      setError('');
      setSuccess('');
      console.log('Requesting registration options for username:', username);

      // 向後端請求註冊選項
      const optionsResp = await axios.get('https://localhost:443/generate-registration-options', {
        params: { username },
      });
      const options = optionsResp.data;

      if (!options || !options.challenge) {
        throw new Error('Registration options are incomplete or missing challenge');
      }      
      
      // 將 `challenge` 和 `user.id` 轉換為 Uint8Array
    //   options.challenge = bufferDecode(options.challenge);
    //   options.user.id = bufferDecode(options.user.id);

      console.log('Received registration options:', options);

      // 向認證器請求註冊
      const attestationResponse = await startRegistration({ optionsJSON: options });

      console.log('Received attestation response:', attestationResponse);

      // 將認證器的回應傳回後端進行驗證
      const verificationResp = await axios.post('https://localhost:443/verify-registration', {
        username,
        response: attestationResponse,
      });
      const { verified } = verificationResp.data;

      console.log('Received verification response:', verificationResp.data);

      if (verified) {
        setSuccess('註冊成功！您現在可以返回登入頁面。');
      } else {
        setError('註冊失敗，請重試。');
      }
    } catch (err) {
      setError('註冊過程中發生錯誤，請稍後再試。');
      console.error('Error during registration process:', err);
    } finally {
      setLoading(false); // 無論成功與否，清除加載狀態
    }
  };

  return (
    <div className="register-container">
      <h1>註冊</h1>
      <p className="register-instruction">輸入用戶名並進行註冊以啟用 WebAuthn</p>
      <input
        type="text"
        placeholder="輸入用戶名"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="register-input"
      />
      <button onClick={handleRegister} className="register-button" disabled={loading}>
        {loading ? '註冊中...' : '開始註冊'}
      </button>
      {success && <p className="register-success">{success}</p>}
      {error && <p className="register-error">{error}</p>}
      <p className="back-to-login">
        已有帳號？<Link to="/">返回登入頁面</Link>
      </p>
    </div>
  );
};

export default Register;
