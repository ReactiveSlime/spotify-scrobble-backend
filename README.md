# Spotify Scrobbler

Spotify Scrobbler is a web application designed to track and display detailed listening statistics from your Spotify account. It integrates a Node.js backend and a PHP-based frontend to provide users with rich insights into their listening habits.

This is the backend

----------

## Features

-   **Authorization with Spotify**: Handles Spotify OAuth2 authorization.
-   **Database Management**: Creates and maintains two MySQL tables:
    -   **`playbacks`**: Stores detailed information about songs played.
    -   **`artists`**: Records the artists a user listens to, including splitting entries for songs with multiple artists.
-   **Song Genre Fetching**: Retrieves genres using Last.fm and MusicBrainz APIs, defaulting to "Unknown" if unavailable.
-   **Spotify API Integration**: Uses the following Spotify endpoints:
    -   `/v1/me/player/currently-playing`
    -   `/v1/me/player/devices`
    -   `/v1/playlists/`
    -   `/v1/albums/`

----------

## Installation

### Backend

1.  Clone the repository:
    
    ```bash
    git clone https://github.com/reactiveslime/spotify-scrobble.git
    
    ```
    
2.  Navigate to the backend directory:
    
    ```bash
    cd spotify-scrobble/backend
    
    ```
    
3.  Install dependencies:
    
    ```bash
    npm install
    
    ```
    

### Required Node.js Packages

-   `axios`
-   `dotenv`
-   `express`
-   `musicbrainz-api`
-   `mysql2`

4.  Set up environment variables in a `.env` file:
    
    ```
    SPOTIFY_CLIENT_ID=your_spotify_client_id
    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
    LOCAL_IP=server_internal_IP
    SPOTIFY_REDIRECT_URI=your_redirect_uri
    LASTFM_API_KEY=your_lastfm_api_key
    MYSQL_HOST=your_database_host
    MYSQL_PORT=your_database_port
    MYSQL_USER=your_database_user
    MYSQL_PASSWORD=your_database_password
    MYSQL_DATABASE=your_database_name
    
    ```
    
5.  Run the backend:
    
    ```bash
    node index.js
    ```

---


## Database Structure
`playbacks` Table

| Column | Data Type | Description |
|--|--|--|
| id | INT| Incremental Key |
| song | VARCHAR(255) | Song name |
| album| VARCHAR(255) | Album name |
| Artist| VARCHAR(255) | Artist name |
| genres| VARCHAR(255) | Song genres (If available) |
| duration_ms| INT| Songs duration in MS |
| seconds_played| INT | Seconds played |
| played_at| DATETIME | The time the song was played at stored as UTC |
| album_cover_url| VARCHAR(255) | The link to the album cover |
| song_uri| VARCHAR(255) | Spotifys song URI |
| track_popularity| INT | The popularity of the song according to spotify |
| playback_device| VARCHAR(255) | Device used to play the song |
| release_date| DATE | The date the song was released |
| playlist_name| VARCHAR(255) | The name of the playlist the song played from |

`artists` Table
| Column | Data Type | Description |
|--|--|--|
| id | INT| Incremental Key |
| artist_name| VARCHAR(255) | Artists name |
| seconds_played| INT | Seconds played |
| played_at| DATETIME| The date the artists were played stored as UTC |

----------

## Contributing

Feel free to fork the repository and submit pull requests for improvements or bug fixes.

----------

## License

This project is licensed under the MIT License.

----------

## Acknowledgments

-   [Spotify API](https://developer.spotify.com/documentation/web-api/)
    
-   Last.fm API
    
-   MusicBrainz API