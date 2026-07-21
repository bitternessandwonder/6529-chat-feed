# 6529 Chat Feed

This is a small, read-only website that loads public `CHAT` drops returned by
the 6529 V2 drops API and combines them into one feed.

It does not post, edit, or delete anything.

## The easiest way to start

### Windows

1. Install Node.js from the official Node.js website.
2. Unzip this folder.
3. Double-click `START-WINDOWS.bat`.
4. Your browser should open to `http://localhost:3000`.

Keep the black command window open while using the feed. Close it to stop the
feed.

### macOS

1. Install Node.js from the official Node.js website.
2. Unzip this folder.
3. Double-click `START-MAC.command`.
4. Your browser should open to `http://localhost:3000`.

If macOS blocks the file, right-click `START-MAC.command`, select **Open**, and
then confirm.

### Terminal alternative

Open a terminal in this folder and run:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

Node.js 18 or newer is required. This project has no third-party package
dependencies, so `npm install` is not required.

## What the app does

- Requests pages from `https://api.6529.io/api/v2/drops`
- Filters the response to entries whose drop type is `CHAT`
- Shows author, wave, timestamp, text, and common image/video attachments
- Refreshes the newest page every 30 seconds
- Lets you load older pages and search the messages already loaded

## Current limitation

This first version is public and unauthenticated. It only displays chats the
6529 API returns without wallet authentication. Private and gated waves would
require a wallet-signature login flow and permission to access those waves.

## Troubleshooting

### “node is not recognized” or “command not found: node”

Node.js is not installed, or the computer needs to be restarted after
installation.

### The page opens but reports an API error

Check the internet connection and try **Refresh**. The 6529 API may be
temporarily unavailable, may require authentication, or may have changed its
response format.

### Change the port

Run:

Windows PowerShell:

```powershell
$env:PORT=4000; npm start
```

macOS/Linux:

```bash
PORT=4000 npm start
```

Then open `http://localhost:4000`.

## Files

- `server.js`: local web server and 6529 API proxy
- `public/index.html`: page structure
- `public/style.css`: visual design
- `public/app.js`: feed loading, filtering, and rendering
