# yt-sp-bridge

A personal app to bridge YouTube and Spotify — save songs from either platform into playlists, with audio streaming via yt-dlp.

Live at **https://arco.vanderlanth.ch**

---

## Deploying to Infomaniak

The app runs on Infomaniak shared hosting via a managed Node.js runner (`npm start`).

### First-time setup

1. SSH into the server
2. Clone the repo into the project directory
3. Copy secrets to `.env` in the project root (see `.env` keys below)
4. Install dependencies: `npm install`
5. Build: `npm run build`
6. Make sure `yt-dlp` is at `~/yt-dlp`
7. Set `PORT=8765` in `.env` to avoid conflicts

### Deploying updates

```sh
git pull
# If the lock file drifted:
git checkout package-lock.json
git pull

npm run build
touch tmp/restart.txt
```

> **Note:** SSH shell is restricted — avoid `&&`, heredocs, and special characters. Run commands one at a time.

### Restarting the app

```sh
touch tmp/restart.txt
```

### Environment variables (`.env`)

```
TURSO_URL=
TURSO_AUTH_TOKEN=
APP_SECRET=
APP_PASSWORD=
TOTP_SECRET=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=
LASTFM_API_KEY=
PORT=8765
```

The `.env` file is loaded at runtime via `node -r dotenv/config build` (the `start` script).

---

## Local development

```sh
npm install
npm run dev
```
