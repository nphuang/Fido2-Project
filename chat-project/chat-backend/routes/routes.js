import express from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getUserByUsername, getPasskeysByUserId, saveUser, savePasskey, updateCounter } from '../services/databaseService.js';
import { setChallenge, getChallenge } from '../utils/helpers.js';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import {
  getChatroomByName,
  createChatroom,
  addUserToChatroom,
  removeUserFromChatroom,
  getUsersInChatroom,
  deleteChatroom,
  getAllChatrooms,
} from '../services/databaseService.js';

const router = express.Router();

router.post('/create-chatroom', async (req, res) => {
  const { username, roomName } = req.body;

  try {
    const user = await new Promise((resolve, reject) => {
      getUserByUsername(username, (err, user) => {
        if (err || !user) return reject(err || new Error('User not found'));
        resolve(user);
      });
    });

    const chatroom = await new Promise((resolve, reject) => {
      getChatroomByName(roomName, (err, chatroom) => {
        if (err || chatroom) return reject(err || new Error('Chatroom already exists'));
        resolve(chatroom);
      });
    });

    const chatroomId = await new Promise((resolve, reject) => {
      createChatroom(roomName, (err, chatroomId) => {
        if (err) return reject(err);
        resolve(chatroomId);
      });
    });

    await new Promise((resolve, reject) => {
      addUserToChatroom(user.id, chatroomId, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.json({ success: true, chatroomId });
  } catch (error) {
    console.error('Error creating chatroom:', error);
    res.status(400).json({ error: 'Error creating chatroom', details: error.message });
  }
});

router.post('/join-chatroom', async (req, res) => {
  const { username, roomName } = req.body;

  try {
    const user = await new Promise((resolve, reject) => {
      getUserByUsername(username, (err, user) => {
        if (err || !user) return reject(err || new Error('User not found'));
        resolve(user);
      });
    });

    const chatroom = await new Promise((resolve, reject) => {
      getChatroomByName(roomName, (err, chatroom) => {
        if (err || !chatroom) return reject(err || new Error('Chatroom not found'));
        resolve(chatroom);
      });
    });

    await new Promise((resolve, reject) => {
      addUserToChatroom(user.id, chatroom.id, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error joining chatroom:', error);
    res.status(400).json({ error: 'Error joining chatroom', details: error.message });
  }
});

router.post('/leave-chatroom', async (req, res) => {
  const { username, roomName } = req.body;

  try {
    const user = await new Promise((resolve, reject) => {
      getUserByUsername(username, (err, user) => {
        if (err || !user) return reject(err || new Error('User not found'));
        resolve(user);
      });
    });

    const chatroom = await new Promise((resolve, reject) => {
      getChatroomByName(roomName, (err, chatroom) => {
        if (err || !chatroom) return reject(err || new Error('Chatroom not found'));
        resolve(chatroom);
      });
    });

    await new Promise((resolve, reject) => {
      removeUserFromChatroom(user.id, chatroom.id, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const usersInChatroom = await new Promise((resolve, reject) => {
      getUsersInChatroom(chatroom.id, (err, users) => {
        if (err) return reject(err);
        resolve(users);
      });
    });

    if (usersInChatroom.length === 0) {
      await new Promise((resolve, reject) => {
        deleteChatroom(chatroom.id, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving chatroom:', error);
    res.status(400).json({ error: 'Error leaving chatroom', details: error.message });
  }
});

router.get('/chatrooms', async (req, res) => {
  try {
    const chatrooms = await new Promise((resolve, reject) => {
      getAllChatrooms((err, chatrooms) => {
        if (err) return reject(err);
        resolve(chatrooms);
      });
    });

    res.json({ chatrooms });
  } catch (error) {
    console.error('Error fetching chatrooms:', error);
    res.status(400).json({ error: 'Error fetching chatrooms', details: error.message });
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////  



const rpName = 'Chat Room Demo';
const rpID = 'localhost';
const origin = `https://${rpID}:5173`;

// 註冊選項生成 API
router.get('/generate-registration-options', async (req, res) => {
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
      attestationType: 'direct',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    setChallenge(user.id, options.challenge);
    // console.log('Generated registration options:', options);
    res.json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 註冊驗證 API
router.post('/verify-registration', async (req, res) => {
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
router.get('/generate-authentication-options', async (req, res) => {
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
    // console.log('Generated authentication options:', options);
    res.json(options);
  } catch (error) {
    console.error('Error generating authentication options:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 登入驗證 API
router.post('/verify-authentication', async (req, res) => {
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
        publicKey: new Uint8Array(credential.cred_public_key),
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

export default router;