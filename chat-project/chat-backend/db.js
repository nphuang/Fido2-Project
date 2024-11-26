import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const initDB = async () => {
  const db = await open({
    filename: './webauthn.db',
    driver: sqlite3.Database,
  });

  // 用戶表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL
    );
  `);

  // 憑證表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      publicKey BLOB NOT NULL,
      counter INTEGER NOT NULL,
      deviceType TEXT,
      backedUp BOOLEAN,
      transports TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);

  return db;
};
