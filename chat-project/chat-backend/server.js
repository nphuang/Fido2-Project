import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import db from './database.js';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://localhost:5173';

app.use(bodyParser.json());
app.use(cors({ origin: CORS_ORIGIN }));

const rpName = 'Chat Room Demo';
const rpID = 'localhost';
const origin = `https://${rpID}:5173`;

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

const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 分鐘
const challenges = new Map(); // 暫時存儲每個用戶的挑戰碼
function setChallenge(userId, challenge) {
  challenges.set(userId, { challenge, expiresAt: Date.now() + CHALLENGE_EXPIRY_MS });
}
function getChallenge(userId) {
  const challengeData = challenges.get(userId);
  if (challengeData && Date.now() < challengeData.expiresAt) {
    return challengeData.challenge;
  }
  challenges.delete(userId); // 過期後刪除
  return null;
}

// 註冊選項生成 API
app.get('/generate-registration-options', async (req, res) => {
  const { username } = req.query;
  console.log(`Received registration request for username: ${username}`);

  try {
    let user = await new Promise((resolve, reject) => {
      getUserByUsername(username, (err, user) => {
        if (err) return reject(err);
        resolve(user);
      });
    });

    if (!user) {
      const userId = await new Promise((resolve, reject) => {
        saveUser(username, (err, userId) => {
          if (err) return reject(err);
          resolve(userId);
        });
      });
      user = { id: userId, username };
    }

    const passkeys = await new Promise((resolve, reject) => {
      getPasskeysByUserId(user.id, (err, passkeys) => {
        if (err) return reject(err);
        resolve(passkeys);
      });
    });

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

    setChallenge(user.id, options.challenge);
    console.log('Generated registration options:', options);
    res.json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 註冊驗證 API
app.post('/verify-registration', async (req, res) => {
  const { username, response } = req.body;
  console.log('Received verification request for username:', username);

  try {
    const user = await new Promise((resolve, reject) => {
      getUserByUsername(username, (err, user) => {
        if (err || !user) return reject(err || new Error('User not found'));
        resolve(user);
      });
    });

    const expectedChallenge = getChallenge(user.id);
    if (!expectedChallenge) {
      console.error('Challenge not found or expired for user:', user.id);
      return res.status(400).json({ error: 'Challenge not found or expired' });
    }

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verified && registrationInfo) {
      const { credential } = registrationInfo;

      if (!credential) {
        console.error('No credential found in registration info');
        return res.status(400).json({ error: 'No credential found' });
      }

      await new Promise((resolve, reject) => {
        savePasskey({ ...credential, user }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      res.json({ verified: true });
    } else {
      console.log('Verification failed');
      res.json({ verified: false });
    }
  } catch (error) {
    console.error('Error verifying registration response:', error);
    res.status(400).json({ error: 'Verification failed' });
  }
});

// 登入選項生成 API
app.get('/generate-authentication-options', async (req, res) => {
  const { username } = req.query;

  try {
    const user = await new Promise((resolve, reject) => {
      getUserByUsername(username, (err, user) => {
        if (err || !user) return reject(err || new Error('User not found'));
        resolve(user);
      });
    });

    const passkeys = await new Promise((resolve, reject) => {
      getPasskeysByUserId(user.id, (err, passkeys) => {
        if (err) return reject(err);
        resolve(passkeys);
      });
    });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((key) => ({
        id: key.cred_id,
        type: 'public-key',
      })),
    });

    setChallenge(user.id, options.challenge);
    console.log('Generated authentication options:', options);
    res.json(options);
  } catch (error) {
    console.error('Error generating authentication options:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 登入驗證 API
app.post('/verify-authentication', async (req, res) => {
  const { username, response } = req.body;

  console.log('Received authentication request for username:', username);

  try {
    const user = await new Promise((resolve, reject) => {
      getUserByUsername(username, (err, user) => {
        if (err || !user) return reject(err || new Error('User not found'));
        resolve(user);
      });
    });

    const expectedChallenge = getChallenge(user.id);
    if (!expectedChallenge) {
      console.error('Challenge not found or expired for user:', user.id);
      return res.status(400).json({ error: 'Challenge not found or expired' });
    }

    const passkeys = await new Promise((resolve, reject) => {
      getPasskeysByUserId(user.id, (err, passkeys) => {
        if (err) return reject(err);
        resolve(passkeys);
      });
    });

    const credential = passkeys.find((key) => key.cred_id === response.id);

    if (!credential) {
      console.error('Credential not found for ID:', response.id);
      return res.status(400).json({ error: 'Credential not found' });
    }

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.cred_id,
        publicKey: new Uint8Array(credential.cred_public_key), // 確保格式正確
        counter: credential.counter,
      },
    });

    if (verified) {
      await new Promise((resolve, reject) => {
        updateCounter(credential.cred_id, authenticationInfo.newCounter, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      res.json({ verified: true });
    } else {
      console.error('Authentication failed during verification');
      res.json({ verified: false });
    }
  } catch (error) {
    console.error('Error verifying authentication response:', error);
    res.status(400).json({ error: 'Verification failed', details: error.message });
  }
});

// HTTP -> HTTPS 重定向
const httpsServer = https.createServer(
  {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || './localhost-key.pem'), // 私鑰
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || 'localhost.pem'), // 證書
  },
  app // Express 應用
);
app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${HTTPS_PORT}`);
});

// WebSocket 設置
// setupWebSocket(server);
