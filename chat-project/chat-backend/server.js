import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
// const { setupWebSocket } = require('./services/websocket');
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import db from './database.js';
// import { setupWebSocket } from './services/websocket.js';
import { isoUint8Array } from '@simplewebauthn/server/helpers';

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: 'http://localhost:5173' }));


const rpName = 'Chat Room Demo';
const rpID = 'localhost';
const origin = `http://${rpID}:5173`;

// 獲取用戶
function getUserByUsername(username, callback) {
  db.get('SELECT * FROM users WHERE username = ?', [username], callback);
}

// 獲取用戶憑證
function getPasskeysByUserId(userId, callback) {
  db.all('SELECT * FROM passkeys WHERE internal_user_id = ?', [userId], callback);
}

// 保存新用戶
function saveUser(username, callback) {
  db.run('INSERT INTO users (username) VALUES (?)', [username], function (err) {
    callback(err, this.lastID);
  });
}

// 保存憑證
function savePasskey(passkey, callback) {
  db.run(
    `
    INSERT INTO passkeys (
      cred_id, cred_public_key, internal_user_id, webauthn_user_id, counter, 
      backup_eligible, backup_status, transports
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      passkey.id,
      Buffer.from(passkey.publicKey), // 確保 BLOB 格式正確
      passkey.user.id,
      passkey.userHandle, // 確保用戶句柄正確
      passkey.counter || 0,
      passkey.deviceType === 'multiDevice',
      passkey.backedUp || false,
      passkey.transports ? passkey.transports.join(',') : null,
    ],
    (err) => {
      if (err) {
        console.error('Database error when saving passkey:', err);
        return callback(err);
      }
      console.log('Passkey saved successfully');
      callback(null);
    }
  );
}

// 更新 counter
function updateCounter(credID, newCounter, callback) {
  db.run('UPDATE passkeys SET counter = ? WHERE cred_id = ?', [newCounter, credID], callback);
}

const challenges = new Map(); // 暫時存儲每個用戶的挑戰碼

// 註冊選項生成 API
app.get('/generate-registration-options', async (req, res) => {
  const { username } = req.query;
  console.log(`Received registration request for username: ${username}`);

  getUserByUsername(username, async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '資料庫錯誤' });
    }

    if (!user) {
      saveUser(username, async (err, userId) => {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ error: '無法創建用戶' });
        }
        user = { id: userId, username };
        await generateOptions(user, res);
      });
    } else {
      await generateOptions(user, res);
    }
  });

  async function generateOptions(user, res) {
    getPasskeysByUserId(user.id, async (err, passkeys) => {
      if (err) return res.status(500).json({ error: '資料庫錯誤' });

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: isoUint8Array.fromUTF8String(String(user.id)),
        userName: user.username,
        excludeCredentials: passkeys.map((key) => ({
          id: key.cred_id,
          type: 'public-key',
        })),
        // attestationType: 'none',
        attestationType: 'direct',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
      });
      // 存儲挑戰碼
      challenges.set(user.id, options.challenge);
      console.log('Generated registration options:', options);
      res.json(options);
    });
  }
});

// 註冊驗證 API
app.post('/verify-registration', async (req, res) => {
  const { username, response } = req.body;
  console.log('Received verification request for username:', username);

  getUserByUsername(username, async (err, user) => {
    if (err || !user) {
      console.error('User not found or database error:', err);
      return res.status(500).json({ error: '用戶不存在' });
    }

    const expectedChallenge = challenges.get(user.id);
    if (!expectedChallenge) {
      console.error('Challenge not found or expired for user:', user.id);
      return res.status(400).json({ error: '挑戰碼丟失或已過期' });
    }

    try {
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (verified && registrationInfo) {
        console.log('Registration info:', registrationInfo);
        const { credential } = registrationInfo;

        if (!credential) {
          console.error('No credential found in registration info');
          return res.status(400).json({ error: '無法找到憑證信息' });
        }

        savePasskey(
          { ...credential, user },
          (err) => {
            if (err) {
              return res.status(500).json({ error: '無法保存憑證' });
            }
            res.json({ verified: true });
          }
        );
      } else {
        console.log('Verification failed');
        res.json({ verified: false });
      }
    } catch (error) {
      console.error('Error verifying registration response:', error);
      res.status(400).json({ error: '驗證失敗' });
    }
  });
});

// 登入選項生成 API
app.get('/generate-authentication-options', (req, res) => {
  const { username } = req.query;

  getUserByUsername(username, (err, user) => {
    if (err || !user) return res.status(500).json({ error: '用戶不存在' });

    getPasskeysByUserId(user.id, (err, passkeys) => {
      if (err) return res.status(500).json({ error: '資料庫錯誤' });

      const options = generateAuthenticationOptions({
        rpID,
        allowCredentials: passkeys.map((key) => ({
          id: key.cred_id,
          type: 'public-key',
        })),
      });

      res.json(options);
    });
  });
});

// 登入驗證 API
app.post('/verify-authentication', (req, res) => {
  const { username } = req.body;

  getUserByUsername(username, (err, user) => {
    if (err || !user) return res.status(500).json({ error: '用戶不存在' });

    const { response } = req.body;

    getPasskeysByUserId(user.id, (err, passkeys) => {
      if (err) return res.status(500).json({ error: '資料庫錯誤' });

      const credential = passkeys.find((key) => key.cred_id === response.id);

      if (!credential) return res.status(400).json({ error: '憑證未找到' });

      verifyAuthenticationResponse({
        response,
        expectedChallenge: response.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.cred_id,
          publicKey: credential.cred_public_key,
          counter: credential.counter,
        },
      })
        .then(({ verified, authenticationInfo }) => {
          if (verified) {
            updateCounter(credential.cred_id, authenticationInfo.newCounter, (err) => {
              if (err) return res.status(500).json({ error: '無法更新計數器' });
              res.json({ verified: true });
            });
          } else {
            res.json({ verified: false });
          }
        })
        .catch(() => res.status(400).json({ error: '驗證失敗' }));
    });
  });
});

app.listen(4000, () => {
  console.log('Server running at http://localhost:4000');
});

// WebSocket 設置
// setupWebSocket(server);
