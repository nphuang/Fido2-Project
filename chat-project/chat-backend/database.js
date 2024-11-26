import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./webauthn.db');

// 初始化資料庫表
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('Users table initialized');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS passkeys (
      cred_id TEXT PRIMARY KEY,
      cred_public_key BLOB,
      internal_user_id INTEGER,
      webauthn_user_id TEXT UNIQUE,
      counter INTEGER,
      backup_eligible BOOLEAN,
      backup_status BOOLEAN,
      transports TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used TIMESTAMP,
      FOREIGN KEY (internal_user_id) REFERENCES users (id)
    )
  `, (err) => {
    if (err) console.error('Error creating passkeys table:', err);
    else console.log('Passkeys table initialized');
  });
});

export default db;
