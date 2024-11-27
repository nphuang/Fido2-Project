import db from '../database.js';

export function getUserByUsername(username, callback) {
  db.get('SELECT * FROM users WHERE username = ?', [username], callback);
}

export function getPasskeysByUserId(userId, callback) {
  db.all('SELECT * FROM passkeys WHERE internal_user_id = ?', [userId], callback);
}

export function saveUser(username, callback) {
  db.run('INSERT INTO users (username) VALUES (?)', [username], function (err) {
    callback(err, this.lastID);
  });
}

export function savePasskey(passkey, callback) {
  db.run(
    `
    INSERT INTO passkeys (
      cred_id, cred_public_key, internal_user_id, webauthn_user_id, counter, 
      backup_eligible, backup_status, transports
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      passkey.id,
      Buffer.from(passkey.publicKey),
      passkey.user.id,
      passkey.userHandle,
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

export function updateCounter(credID, newCounter, callback) {
  db.run('UPDATE passkeys SET counter = ? WHERE cred_id = ?', [newCounter, credID], callback);
}