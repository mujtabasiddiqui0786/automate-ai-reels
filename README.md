# Automate Reels Backend

A production-ready Node.js backend system for generating and uploading satisfying loop videos to YouTube Shorts, Instagram Reels, and TikTok. Designed to be orchestrated by n8n workflows.

## Features

- 🎬 **Video Generation**: Create satisfying loop videos using ffmpeg with customizable filters
- 📱 **Multi-Platform Upload**: Upload to YouTube Shorts, Instagram Reels, and TikTok
- 🔄 **n8n Integration**: Simple HTTP API endpoints for workflow automation
- 🎨 **Deterministic Generation**: Seed-based randomization for reproducible results
- 🚀 **Zero Dependencies**: Uses only Node.js built-in modules
- 💰 **Cost-Effective**: Optimized for free tiers and minimal resource usage

## Prerequisites

- **Node.js 20+** installed
- **ffmpeg** installed and available in PATH
- API credentials for platforms you want to use (YouTube, Instagram, TikTok)

### Installing ffmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

## Installation

1. Clone or download this repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your API credentials (see Configuration section)
4. Add base video clips to `assets/base_loops/` directory (see `assets/base_loops/README.md`)
5. Start the server:
   ```bash
   node src/server.js
   ```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

#### Required (for each platform you want to use)

**YouTube:**
- `YOUTUBE_CLIENT_ID` - OAuth 2.0 Client ID from Google Cloud Console
- `YOUTUBE_CLIENT_SECRET` - OAuth 2.0 Client Secret
- `YOUTUBE_REFRESH_TOKEN` - OAuth 2.0 Refresh Token

**Instagram:**
- `IG_APP_ID` - Facebook App ID
- `IG_APP_SECRET` - Facebook App Secret
- `IG_ACCESS_TOKEN` - Instagram Graph API Access Token
- `IG_USER_ID` - Instagram Business Account User ID

**TikTok (optional):**
- `TIKTOK_CLIENT_KEY` - TikTok API Client Key
- `TIKTOK_CLIENT_SECRET` - TikTok API Client Secret
- `TIKTOK_ACCESS_TOKEN` - TikTok API Access Token

#### Optional

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `STATIC_BASE_URL` - Base URL for serving videos (must be HTTPS for Instagram)
- `BASE_VIDEO_DIR` - Directory containing base video clips (default: ./assets/base_loops)
- `OUTPUT_VIDEO_DIR` - Directory for generated videos (default: ./videos/output)

### Getting API Credentials

#### YouTube Data API v3

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials (Desktop app type)
5. Use OAuth 2.0 Playground to get refresh token:
   - Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
   - Select YouTube Data API v3 scopes
   - Authorize and exchange for refresh token

#### Instagram Graph API

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Instagram Graph API product
4. Get App ID and App Secret
5. Generate access token with required permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
6. Get your Instagram Business Account User ID

#### TikTok Posting API

1. Go to [TikTok Developers](https://developers.tiktok.com/)
2. Create an app
3. Get Client Key and Client Secret
4. Generate access token with video upload permissions

## API Endpoints

### POST /generate

Generate a new satisfying loop video.

**Request:**
```json
{
  "style": "gradient",
  "durationSeconds": 25,
  "seed": 12345
}
```

**Response:**
```json
{
  "filePath": "/absolute/path/to/loop_1234567890_12345.mp4",
  "publicUrl": "http://localhost:3000/videos/loop_1234567890_12345.mp4",
  "meta": {
    "style": "gradient",
    "durationSeconds": 25,
    "seed": 12345,
    "baseClip": "smooth_loop.mp4",
    "hueShift": 15,
    "saturation": "1.1",
    "brightness": "1.0",
    "speedMultiplier": "1.05",
    "mirror": true,
    "scale": "1.1"
  },
  "titles": {
    "youtubeTitle": "Satisfying Loop Video #42 - Infinity Loop",
    "youtubeDescription": "...",
    "youtubeTags": ["satisfying", "loop", "infinity loop", ...],
    "instagramCaption": "✨ Satisfying infinity loop ✨\n\n...",
    "tiktokCaption": "Satisfying infinity loop! Watch this gradient loop over and over 🔄 #satisfying #loop ..."
  }
}
```

### POST /upload/youtube

Upload a video to YouTube Shorts.

**Request:**
```json
{
  "filePath": "/absolute/path/to/video.mp4",
  "title": "Satisfying Loop Video #42 - Infinity Loop",
  "description": "Watch this satisfying infinity loop...",
  "tags": ["satisfying", "loop", "infinity loop"]
}
```

**Response:**
```json
{
  "success": true,
  "videoId": "dQw4w9WgXcQ",
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### POST /upload/instagram

Upload a video to Instagram Reels.

**Request:**
```json
{
  "filePath": "/absolute/path/to/video.mp4",
  "caption": "✨ Satisfying infinity loop ✨\n\nWatch this mesmerizing gradient loop..."
}
```

**Response:**
```json
{
  "success": true,
  "reelId": "1234567890123456789",
  "permalink": "https://www.instagram.com/reel/1234567890123456789/"
}
```

### POST /upload/tiktok

Upload or export a video to TikTok.

**Request:**
```json
{
  "filePath": "/absolute/path/to/video.mp4",
  "caption": "Satisfying infinity loop! Watch this gradient loop over and over 🔄 #satisfying #loop ..."
}
```

**Response (if API configured):**
```json
{
  "success": true,
  "videoId": "1234567890123456789",
  "shareUrl": "https://www.tiktok.com/@username/video/1234567890123456789"
}
```

**Response (if API not configured):**
```json
{
  "success": true,
  "localPath": "/path/to/exports/tiktok/video.mp4",
  "message": "Video exported to TikTok directory. Upload manually or configure TikTok API credentials."
}
```

### GET /videos/*

Serve static video files. Used internally by Instagram upload process.

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## n8n Integration

### Example Workflow

Create an n8n workflow that runs every 3 hours:

1. **Cron Trigger** (every 3 hours)
2. **HTTP Request** → `POST /generate`
   - Method: POST
   - URL: `http://your-server:3000/generate`
   - Body (JSON):
     ```json
     {
       "style": "gradient",
       "durationSeconds": 25,
       "seed": {{ $now.toMillis() }}
     }
     ```
3. **HTTP Request** → `POST /upload/youtube`
   - Method: POST
   - URL: `http://your-server:3000/upload/youtube`
   - Body (JSON):
     ```json
     {
       "filePath": "{{ $json.filePath }}",
       "title": "{{ $json.titles.youtubeTitle }}",
       "description": "{{ $json.titles.youtubeDescription }}",
       "tags": {{ $json.titles.youtubeTags }}
     }
     ```
4. **HTTP Request** → `POST /upload/instagram`
   - Method: POST
   - URL: `http://your-server:3000/upload/instagram`
   - Body (JSON):
     ```json
     {
       "filePath": "{{ $json.filePath }}",
       "caption": "{{ $json.titles.instagramCaption }}"
     }
     ```
5. **HTTP Request** → `POST /upload/tiktok`
   - Method: POST
   - URL: `http://your-server:3000/upload/tiktok`
   - Body (JSON):
     ```json
     {
       "filePath": "{{ $json.filePath }}",
       "caption": "{{ $json.titles.tiktokCaption }}"
     }
     ```

### n8n Workflow JSON

Save this as a workflow in n8n:

```json
{
  "name": "Automate Reels - Every 3 Hours",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 3
            }
          ]
        }
      },
      "name": "Every 3 Hours",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/generate",
        "jsonParameters": true,
        "bodyParametersJson": "{\n  \"style\": \"gradient\",\n  \"durationSeconds\": 25,\n  \"seed\": {{ $now.toMillis() }}\n}"
      },
      "name": "Generate Video",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [450, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/upload/youtube",
        "jsonParameters": true,
        "bodyParametersJson": "{\n  \"filePath\": \"{{ $json.filePath }}\",\n  \"title\": \"{{ $json.titles.youtubeTitle }}\",\n  \"description\": \"{{ $json.titles.youtubeDescription }}\",\n  \"tags\": {{ $json.titles.youtubeTags }}\n}"
      },
      "name": "Upload to YouTube",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [650, 200]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/upload/instagram",
        "jsonParameters": true,
        "bodyParametersJson": "{\n  \"filePath\": \"{{ $json.filePath }}\",\n  \"caption\": \"{{ $json.titles.instagramCaption }}\"\n}"
      },
      "name": "Upload to Instagram",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [650, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/upload/tiktok",
        "jsonParameters": true,
        "bodyParametersJson": "{\n  \"filePath\": \"{{ $json.filePath }}\",\n  \"caption\": \"{{ $json.titles.tiktokCaption }}\"\n}"
      },
      "name": "Upload to TikTok",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [650, 400]
    }
  ],
  "connections": {
    "Every 3 Hours": {
      "main": [[{ "node": "Generate Video", "type": "main", "index": 0 }]]
    },
    "Generate Video": {
      "main": [[
        { "node": "Upload to YouTube", "type": "main", "index": 0 },
        { "node": "Upload to Instagram", "type": "main", "index": 0 },
        { "node": "Upload to TikTok", "type": "main", "index": 0 }
      ]]
    }
  }
}
```

## Video Generation Details

### ffmpeg Filters

The system applies the following transformations to base videos:

1. **Aspect Ratio**: Resize and crop to 1080x1920 (9:16 vertical format)
2. **Hue Shift**: Adjusts color hue (-30 to +30 degrees)
3. **Saturation**: Adjusts color saturation (0.8x to 1.3x)
4. **Brightness**: Adjusts brightness (0.9x to 1.1x)
5. **Speed**: Adjusts playback speed (0.8x to 1.2x)
6. **Mirroring**: Randomly flips video horizontally
7. **Zoom/Scale**: Applies subtle zoom effect (1.0x to 1.2x)

### Customization

To customize filter ranges, edit `src/video/generator.js`:

```javascript
// Line ~42-47: Adjust these ranges
const hueShift = generateSeedValue(seed, -30, 30); // Change range here
const saturation = generateSeedFloat(seed + 1, 0.8, 1.3); // Change range here
const brightness = generateSeedFloat(seed + 2, 0.9, 1.1); // Change range here
const speedMultiplier = generateSeedFloat(seed + 3, 0.8, 1.2); // Change range here
```

## Example curl Commands

### Generate Video
```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "style": "gradient",
    "durationSeconds": 25,
    "seed": 12345
  }'
```

### Upload to YouTube
```bash
curl -X POST http://localhost:3000/upload/youtube \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/absolute/path/to/video.mp4",
    "title": "Satisfying Loop Video",
    "description": "Watch this satisfying infinity loop!",
    "tags": ["satisfying", "loop", "infinity loop"]
  }'
```

### Upload to Instagram
```bash
curl -X POST http://localhost:3000/upload/instagram \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/absolute/path/to/video.mp4",
    "caption": "✨ Satisfying infinity loop ✨ #satisfying #loop"
  }'
```

### Upload to TikTok
```bash
curl -X POST http://localhost:3000/upload/tiktok \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/absolute/path/to/video.mp4",
    "caption": "Satisfying infinity loop! #satisfying #loop"
  }'
```

## Troubleshooting

### ffmpeg not found
- Ensure ffmpeg is installed and in your PATH
- Test with: `ffmpeg -version`

### Video generation fails
- Check that base video files exist in `assets/base_loops/`
- Ensure base videos are in a supported format
- Check file permissions

### YouTube upload fails
- Verify OAuth credentials are correct
- Check that refresh token is valid
- Ensure YouTube Data API v3 is enabled in Google Cloud Console

### Instagram upload fails
- Verify access token is valid and has required permissions
- Ensure video URL is accessible via HTTPS (required by Instagram)
- Check that `STATIC_BASE_URL` is set to an HTTPS URL

### TikTok export only
- TikTok API upload is not yet fully implemented
- Videos will be exported to `exports/tiktok/` directory
- Upload manually or implement TikTok API based on official docs

## Project Structure

```
automate-reels/
├── src/
│   ├── server.js           # Main HTTP server
│   ├── config.js           # Configuration module
│   ├── video/
│   │   ├── generator.js    # Video generation logic
│   │   └── utils.js        # ffmpeg utilities
│   ├── metadata/
│   │   └── generator.js    # Metadata generation
│   └── upload/
│       ├── youtube.js      # YouTube upload
│       ├── instagram.js    # Instagram upload
│       └── tiktok.js       # TikTok upload/export
├── assets/
│   └── base_loops/         # Base video clips
├── videos/
│   └── output/             # Generated videos
├── exports/
│   └── tiktok/             # TikTok exports (if API not configured)
├── .env.example            # Environment variable template
├── package.json            # Project metadata
└── README.md               # This file
```

## License

MIT

## Contributing

This is a production-ready system designed for automation. Feel free to customize and extend as needed for your use case.

