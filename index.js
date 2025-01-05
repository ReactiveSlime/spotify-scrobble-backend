#!/usr/bin/env node

const axios = require('axios');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { saveTokens, getTokens } = require('./auth');
dotenv.config();

// Constants and global variables
let currentTrack = null;
let secondsPlayed = 0;
let playbackState = null; // Track playback state to prevent spamming
let lastPlaylistFetchTime = 0; // Store last time playlist name was fetched to avoid frequent requests

// Create a database connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Refresh the access token
async function refreshAccessToken() {
  const tokens = getTokens();
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    console.error('No refresh token available. Please re-authenticate.');
    return null;
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const newTokens = response.data;
    saveTokens(newTokens);
    console.log('Access token refreshed successfully');
    return newTokens.access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error.response?.data || error.message);
    return null;
  }
}

// Function to get playback devices
async function getPlaybackDevice() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const devices = response.data.devices;
    const activeDevice = devices.find((device) => device.is_active);

    return activeDevice ? activeDevice.type : 'Unknown';
  } catch (error) {
    console.error('Error fetching playback device:', error.response?.data || error.message);
    return 'Unknown';
  }
}

// Function to get a valid access token, refreshing if necessary
async function getValidAccessToken() {
  const tokens = getTokens();

  if (!tokens.access_token) {
    console.error('No access token available. Please re-authenticate.');
    return null;
  }

  if (Date.now() >= tokens.expires_at) {
    console.log('Access token expired. Refreshing...');
    return await refreshAccessToken();
  }

  return tokens.access_token;
}

// Function to get the currently playing track
async function getCurrentTrack() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.data || !response.data.item) {
      return null; // No song is currently playing
    }

    const isPlaying = response.data.is_playing; // Playback state
    const track = response.data.item;
    const song = track.name;
    const album = track.album.name;
    const artist = track.artists.map((artist) => artist.name).join(', ');
    const duration = track.duration_ms;
    const releaseDate = track.album.release_date; // Fetch release date
    const playedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const albumCoverUrl = track.album.images && track.album.images.length > 0 ? track.album.images[0].url : null;
    const songUri = track.uri;
    const popularity = track.popularity;

    // Attempt to fetch playlist name only if the song is new
    const context = response.data.context;
    const playlistName = context && context.type === 'playlist' && track.name !== currentTrack?.song
      ? await getPlaylistName(context.href, accessToken)
      : 'Unknown';

    return { song, album, artist, duration, releaseDate, playedAt, isPlaying, albumCoverUrl, songUri, popularity, playlistName };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('Access token expired. Refreshing and retrying...');
      await refreshAccessToken();
      return getCurrentTrack(); // Retry after refreshing token
    } else if (error.response && error.response.status === 429) {
      console.log('Rate limit reached. Will retry on next song.');
      return null; // Return null to avoid retrying immediately
    }
    console.error('Error fetching currently playing track:', error.response?.data || error.message);
    return null;
  }
}

async function getPlaylistName(playlistUrl, accessToken) {
  const now = Date.now();
  if (now - lastPlaylistFetchTime < 5000) { // Avoid fetching the playlist name too frequently (e.g., 5 seconds gap)
    console.log('Skipping playlist fetch to prevent too many requests.');
    return 'Unknown';
  }
  try {
    const response = await axios.get(playlistUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    lastPlaylistFetchTime = now; // Update last fetch time
    return response.data.name || 'Unknown';
  } catch (error) {
    console.error('Error fetching playlist name:', error.response?.data || error.message);
    return 'Unknown';
  }
}

// Fetch genres from Last.fm
async function fetchGenreFromLastFm(artist, track) {
  const url = `http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${process.env.LASTFM_API_KEY}&artist=${encodeURIComponent(
    artist
  )}&track=${encodeURIComponent(track)}&format=json`;

  try {
    const response = await axios.get(url);
    if (response.data && response.data.track && response.data.track.toptags.tag.length > 0) {
      return response.data.track.toptags.tag.map((t) => t.name); // Return genre tags
    }
  } catch (error) {
    console.error('Error fetching genre from Last.fm:', error.message);
  }
  return null; // Return null if no genre is found
}

// Fetch genres from MusicBrainz
async function fetchGenreFromMusicBrainz(artist, track) {
  const baseUrl = 'https://musicbrainz.org/ws/2/recording/';
  const query = `?query=artist:${encodeURIComponent(artist)} AND recording:${encodeURIComponent(
    track
  )}&fmt=json`;

  try {
    const response = await axios.get(baseUrl + query);
    if (response.data && response.data.recordings && response.data.recordings.length > 0) {
      const recording = response.data.recordings[0];
      if (recording.tags && recording.tags.length > 0) {
        return recording.tags.map((tag) => tag.name); // Return genre tags
      }
    }
  } catch (error) {
    console.error('Error fetching genre from MusicBrainz:', error.message);
  }
  return null;
}

// Fetch genres by trying multiple sources
async function fetchGenres(artist, track) {
  let genres = await fetchGenreFromLastFm(artist, track);
  if (genres && genres.length > 0) {
    return genres;
  }
  console.log('Falling back to MusicBrainz...');
  genres = await fetchGenreFromMusicBrainz(artist, track);
  return genres || ['Unknown']; // Return 'Unknown' if no genre is found
}

// Save artist information to the database
async function saveArtistsToDatabase(track, secondsPlayed) {
  const playedAt = track.playedAt;
  const artists = track.artist.split(', '); // Split multiple artists

  for (const artist of artists) {
    try {
      await db.query(
        `INSERT INTO artists (artist_name, seconds_played, played_at) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE 
        seconds_played = seconds_played + ?, 
        played_at = GREATEST(played_at, VALUES(played_at))`,
        [
          artist.trim(),
          secondsPlayed,
          playedAt,
          secondsPlayed,
        ]
      );
      console.log(
        `Artist saved to database:\n` +
        `Artist: ${artist.trim()}\n` +
        `Seconds Played: ${secondsPlayed}\n` +
        `Played At: ${playedAt}\n` +
        `Release Date: ${track.releaseDate || 'Unknown'}\n` +
        `Playlist Name: ${track.playlistName || 'Unknown'}`
      );
    } catch (error) {
      console.error(`Error saving artist (${artist}) to database:`, error.message);
    }
  }
}

// Update saveToDatabase to include artist handling
async function saveToDatabase(track, secondsPlayed, playbackDevice) {
  try {
    await db.query(
      `INSERT INTO playbacks 
      (song, album, artist, genres, duration_ms, seconds_played, played_at, album_cover_url, song_uri, track_popularity, playback_device, release_date, playlist_name) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        track.song,
        track.album,
        track.artist,
        track.genres || 'Unknown',
        track.duration,
        secondsPlayed,
        track.playedAt,
        track.albumCoverUrl,
        track.songUri,
        track.popularity,
        playbackDevice,
        track.releaseDate, // New field: release date
        track.playlistName, // New field: playlist name
      ]
    );

    console.log(
      `\x1b[32m\nTrack saved to database:\nSong: ${track.song}\nArtists: ${track.artist}\nGenres: ${track.genres || 'Unknown'}\nPlayback Device: ${playbackDevice}\nPopularity: ${track.popularity}\nRelease Date: ${track.releaseDate}\nPlaylist Name: ${track.playlistName}\n\x1b[0m`
    );    

  } catch (error) {
    console.error('Error saving to database:', error.message);
  }
}

// Save the current track info to the database or update its play duration
async function saveOrUpdateTrack(track) {
  if (track.isPlaying) {
    // Check if the current state is 'paused' and log a message when resuming
    if (playbackState === 'paused') {
      console.log('Playback resumed.');
    }
    // If the same song is playing, update seconds played
    if (
      currentTrack &&
      currentTrack.song === track.song &&
      currentTrack.artist === track.artist &&
      currentTrack.album === track.album
    ) {
      secondsPlayed++; // Increment seconds for each second the song is playing
    } else {
      // New song is playing, save the old song if it exists
      if (currentTrack) {
        const playbackDevice = await getPlaybackDevice();
        saveToDatabase(currentTrack, secondsPlayed, playbackDevice);
        saveArtistsToDatabase(currentTrack, secondsPlayed);
      }

      // Start tracking the new song
      currentTrack = track;
      secondsPlayed = 1;

      // Fetch genres asynchronously
      fetchGenres(track.artist, track.song).then(async (genres) => {
        currentTrack.genres = genres.join(', ');
        const playbackDevice = await getPlaybackDevice();
        console.log(
          `\nNow playing:\nSong: ${track.song}\nArtists: ${track.artist}\nTrack Duration: ${track.duration}\nGenres: ${genres.join(', ')}\nPlayback Device: ${playbackDevice}\nPopularity: ${track.popularity}\n`
        );
      });
    }
    playbackState = 'playing';
  } else {
    if (playbackState !== 'paused') {
      console.log('Playback paused.');
      playbackState = 'paused';
    }
  }
}

// Main loop to check the current track
async function trackListening() {
  setInterval(async () => {
    const track = await getCurrentTrack();
    if (track) {
      saveOrUpdateTrack(track);
    } else {
      console.log('No song is currently playing.');
      playbackState = null;
    }
  }, 1000); // Check every second
}

trackListening();
