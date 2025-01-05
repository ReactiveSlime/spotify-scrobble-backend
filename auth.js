#!/usr/bin/env node

const express = require('express');
const axios = require('axios');
const qs = require('qs');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const app = express();
const port = 3616;

// Spotify authentication and token URLs
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Token file path
const TOKEN_FILE = 'tokens.json';

// Utility function to save tokens to a file
function saveTokens(tokens) {
  const data = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || getTokens().refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000, // Calculate expiration time
  };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Tokens saved successfully');
}

// Utility function to read tokens from the file
function getTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  }
  return {};
}

// Step 1: Create the auth URL to request access
app.get('/', (req, res) => {
  const authUrl = `${AUTH_URL}?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}&scope=user-library-read user-read-playback-state user-read-currently-playing`;
  res.send(`<a href="${authUrl}">Click here to login with Spotify</a>`);
});

// Step 2: Handle the callback from Spotify and get the access token
app.get('/callback', (req, res) => {
  const code = req.query.code;
  const body = qs.stringify({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
  });

  const headers = {
    'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  axios
    .post(TOKEN_URL, body, { headers })
    .then((response) => {
      const { access_token, refresh_token, expires_in } = response.data;

      // Save tokens to JSON file
      saveTokens({ access_token, refresh_token, expires_in });

      res.send('Authentication successful! Tokens have been saved.');
    })
    .catch((error) => {
      console.error('Error getting token', error.response?.data || error.message);
      res.send('Error getting access token');
    });
});

// Start the server
app.listen(port, process.env.LOCAL_IP, () => {
  console.log(`Server running at http://${process.env.LOCAL_IP}:${port}`);
});

// Export the saveTokens function for use in other files
module.exports = { saveTokens, getTokens };
