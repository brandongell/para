# Google Drive Integration Setup Guide

This guide will help you set up the Google Drive integration for the Legal Document Organizer.

## Prerequisites

1. A Google Cloud Platform account
2. A Google Drive account
3. Node.js 16+ installed

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Legal Document Organizer")
4. Click "Create"

## Step 2: Enable Google Drive API

1. In your project dashboard, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" for user type
   - Fill in the required fields (app name, user support email, etc.)
   - Add your email to test users
   - Add the following scopes:
     - `https://www.googleapis.com/auth/drive`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/drive.metadata`

4. Create OAuth client ID:
   - Application type: "Web application"
   - Name: "Legal Document Organizer"
   - Authorized redirect URIs:
     - For local development: `http://localhost:3000/auth/google/callback`
     - For Railway: `https://your-app.railway.app/auth/google/callback`
   
5. Save the Client ID and Client Secret

## Step 4: Configure Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Set mode to google-drive
MODE=google-drive

# Your OpenAI and Gemini keys (same as before)
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# Google Drive configuration
GOOGLE_CLIENT_ID=your_client_id_from_step_3
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_3
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# You'll get this after selecting a folder
DRIVE_FOLDER_ID=

# Server port
PORT=3000
```

## Step 5: Get Your Drive Folder ID

### Option A: Create a New Folder
1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder (e.g., "Legal Documents Inbox")
3. Open the folder
4. The URL will look like: `https://drive.google.com/drive/folders/1abc123def456ghi`
5. Copy the ID after `/folders/` (in this example: `1abc123def456ghi`)

### Option B: Use an Existing Folder
1. Navigate to the folder in Google Drive
2. Copy the folder ID from the URL

Add the folder ID to your `.env` file:
```
DRIVE_FOLDER_ID=1abc123def456ghi
```

## Step 6: Run the Application

### Local Development

```bash
# Install dependencies
npm install

# Build the TypeScript files
npm run build

# Start the server
npm run dev:server
```

### First-Time Setup

1. Open your browser and go to `http://localhost:3000`
2. Click "Connect Google Drive"
3. Authorize the application
4. You'll be redirected back to the dashboard

## Step 7: Using the System

### Automatic Processing
- Any files added to your monitored Google Drive folder will be automatically:
  - Downloaded temporarily
  - Classified using AI
  - Moved to the appropriate organized folder
  - Tagged with metadata

### Manual Scan
- Visit `http://localhost:3000/scan` to manually trigger a folder scan
- Or click "Scan Folder Now" on the dashboard

### Folder Structure
The system will create these folders in your Google Drive:
- 01_Corporate_and_Governance
- 02_People_and_Employment
- 03_Finance_and_Investment
- 04_Sales_and_Revenue
- 05_Operations_and_Vendors
- 06_Technology_and_IP
- 07_Marketing_and_Partnerships
- 08_Risk_and_Compliance
- 09_Templates
- 10_Archive

## Step 8: Deploy to Railway

1. Push your code to GitHub
2. Create a new Railway project
3. Connect your GitHub repository
4. Add environment variables in Railway dashboard
5. Update `GOOGLE_REDIRECT_URI` to your Railway URL
6. Update the authorized redirect URI in Google Cloud Console
7. Deploy!

## Webhook Setup (Advanced)

For real-time processing without polling:

1. Set `WEBHOOK_URL` in your environment variables
2. The system will automatically register webhooks with Google Drive
3. Any changes will trigger immediate processing

## Troubleshooting

### "Not authenticated" error
- Delete `token.json` if it exists
- Restart the server and re-authenticate

### Files not being processed
- Check that files are in the monitored folder (not subfolders)
- Verify the file type is supported (PDF, DOCX, DOC, TXT)
- Check the server logs for errors

### Permission errors
- Ensure the app has access to the folder
- For shared folders, make sure you have edit permissions

## Security Notes

- Never commit your `.env` file
- Keep your Client Secret secure
- Regularly review authorized access in your Google Account settings
- The `token.json` file contains sensitive data - keep it secure