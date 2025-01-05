#!/usr/bin/env node

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Create database connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

async function setupDatabase() {
  try {
    // Create the `playbacks` table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS playbacks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        song VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        artist VARCHAR(255) NOT NULL,
        genres VARCHAR(255),
        duration_ms INT NOT NULL,
        seconds_played INT NOT NULL,
        played_at DATETIME NOT NULL,
        album_cover_url VARCHAR(255),
        song_uri VARCHAR(255),
        track_popularity INT,
        playback_device VARCHAR(255),
        release_date DATE,
        playlist_name VARCHAR(255)
      );
    `);
    console.log('Table `playbacks` setup completed.');

    // Create the `artist` table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS artists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        artist_name VARCHAR(255) NOT NULL,
        seconds_played INT DEFAULT 0,
        played_at DATETIME NOT NULL
      );
    `);
    console.log('Table `artist` setup completed.');
  } catch (error) {
    console.error('Error setting up database:', error.message);
  } finally {
    db.end();
  }
}

setupDatabase();
