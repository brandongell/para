import express from 'express';
import * as dotenv from 'dotenv';
import { GoogleAuthService, GoogleAuthConfig } from './services/googleAuthService';
import { GoogleDriveService } from './services/googleDriveService';
import { GoogleDriveMonitorService } from './services/googleDriveMonitorService';
import { DiscordBotService } from './services/discordBotService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Services
let authService: GoogleAuthService;
let driveService: GoogleDriveService | null = null;
let monitorService: GoogleDriveMonitorService | null = null;
let discordBot: DiscordBotService | null = null;

// Initialize services
async function initializeServices() {
  // Check operation mode
  const mode = process.env.MODE || 'local';
  
  if (mode === 'google-drive') {
    console.log('🚀 Starting in Google Drive mode...');
    
    // Initialize Google Auth
    const authConfig: GoogleAuthConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata'
      ]
    };
    
    authService = new GoogleAuthService(authConfig);
    
    // Try to authenticate
    try {
      const client = await authService.getAuthenticatedClient();
      driveService = new GoogleDriveService(client);
      
      // Initialize monitor service
      const monitoredFolderId = process.env.DRIVE_FOLDER_ID || '';
      monitorService = new GoogleDriveMonitorService(
        driveService,
        process.env.OPENAI_API_KEY || '',
        process.env.GEMINI_API_KEY,
        monitoredFolderId
      );
      
      if (monitoredFolderId) {
        await monitorService.initialize(monitoredFolderId);
      }
      
      console.log('✅ Google Drive services initialized');
    } catch (error) {
      console.log('⚠️  Not authenticated. Please visit /auth/google to authenticate.');
    }
  }
  
  // Initialize Discord bot if configured
  if (process.env.DISCORD_BOT_TOKEN) {
    const organizeFolderPath = mode === 'google-drive' 
      ? process.env.DRIVE_FOLDER_ID || ''
      : process.env.ORGANIZE_FOLDER_PATH || './documents';
      
    discordBot = new DiscordBotService(
      process.env.DISCORD_BOT_TOKEN,
      organizeFolderPath,
      process.env.OPENAI_API_KEY || '',
      process.env.GEMINI_API_KEY,
      {
        apiUrl: process.env.DOCUMENSO_API_URL || '',
        apiToken: process.env.DOCUMENSO_API_TOKEN || '',
        appUrl: process.env.DOCUMENSO_APP_URL
      }
    );
    
    await discordBot.start();
    console.log('🤖 Discord bot started');
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: process.env.MODE || 'local',
    services: {
      googleDrive: driveService ? 'connected' : 'not connected',
      discord: discordBot ? 'running' : 'not configured'
    }
  });
});

// Root route
app.get('/', (req, res) => {
  const isAuthenticated = authService?.isAuthenticated() || false;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Legal Document Organizer</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>📁 Legal Document Organizer</h1>
      <p>AI-powered document organization system</p>
      
      <div class="status ${isAuthenticated ? 'connected' : 'disconnected'}">
        Google Drive: ${isAuthenticated ? '✅ Connected' : '❌ Not Connected'}
      </div>
      
      ${!isAuthenticated ? `
        <a href="/auth/google" class="button">Connect Google Drive</a>
        
        <div class="info">
          <h3>Setup Instructions:</h3>
          <ol>
            <li>Click "Connect Google Drive" above</li>
            <li>Authorize access to your Google Drive</li>
            <li>Select or create a folder to monitor</li>
            <li>The system will automatically organize new documents</li>
          </ol>
        </div>
      ` : `
        <div class="info">
          <h3>✅ System Ready</h3>
          <p>The document organizer is monitoring your Google Drive folder.</p>
          <p>Any new documents added will be automatically classified and organized.</p>
        </div>
        
        <a href="/status" class="button">View Status</a>
        <a href="/scan" class="button">Scan Folder Now</a>
      `}
      
      <hr style="margin: 30px 0;">
      
      <h3>API Endpoints:</h3>
      <ul>
        <li><code>GET /health</code> - Health check</li>
        <li><code>GET /auth/google</code> - Start Google OAuth</li>
        <li><code>GET /auth/google/callback</code> - OAuth callback</li>
        <li><code>POST /webhook/google-drive</code> - Google Drive webhook</li>
        <li><code>GET /status</code> - Processing status</li>
        <li><code>POST /scan</code> - Manually scan folder</li>
      </ul>
    </body>
    </html>
  `);
});

// Google OAuth routes
app.get('/auth/google', (req, res) => {
  if (!authService) {
    return res.status(500).json({ error: 'Auth service not initialized' });
  }
  
  const authUrl = authService.getAuthUrl();
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code missing' });
  }
  
  try {
    await authService.handleAuthorizationCode(code);
    
    // Reinitialize services after authentication
    await initializeServices();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #28a745; font-size: 24px; margin: 20px 0; }
          .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Authentication Successful!</h1>
        <p>Your Google Drive has been connected successfully.</p>
        <p>The system is now ready to organize your documents.</p>
        
        <a href="/" class="button">Go to Dashboard</a>
        <a href="/status" class="button">View Status</a>
        
        <script>
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).json({ error: 'Failed to authenticate', details: error });
  }
});

// Google Drive webhook endpoint
app.post('/webhook/google-drive', async (req, res) => {
  console.log('📨 Webhook received:', {
    headers: req.headers,
    body: req.body
  });
  
  // Verify the webhook is from Google
  const channelId = req.headers['x-goog-channel-id'];
  const resourceState = req.headers['x-goog-resource-state'];
  
  if (!channelId || !resourceState) {
    return res.status(400).send('Invalid webhook');
  }
  
  // Acknowledge the webhook immediately
  res.status(200).send('OK');
  
  // Process the notification asynchronously
  if (monitorService) {
    monitorService.handleWebhookNotification(req.headers, req.body).catch(error => {
      console.error('Error processing webhook:', error);
    });
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  if (!monitorService) {
    return res.status(503).json({ error: 'Monitor service not initialized' });
  }
  
  const status = monitorService.getStatus();
  res.json(status);
});

// Manual scan endpoint
app.post('/scan', async (req, res) => {
  if (!monitorService) {
    return res.status(503).json({ error: 'Monitor service not initialized' });
  }
  
  res.json({ message: 'Scan started' });
  
  // Run scan asynchronously
  monitorService.scanAndProcessFolder().catch(error => {
    console.error('Error during scan:', error);
  });
});

// Discord OAuth callback (existing)
app.get('/auth/discord/callback', (req, res) => {
  const { code, guild_id } = req.query;
  
  console.log('🎉 Discord OAuth callback received!');
  console.log('Authorization Code:', code);
  console.log('Guild ID (Server):', guild_id);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bot Installation Complete</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1 class="success">✅ Bot Successfully Installed!</h1>
      <p>Your Legal Document Organizer bot has been added to your Discord server.</p>
      
      <div class="info">
        <h3>Next Steps:</h3>
        <ol style="text-align: left;">
          <li>Close this browser tab</li>
          <li>Go to your Discord server</li>
          <li>The bot should already be running</li>
          <li>Test the bot by uploading a document or asking questions</li>
        </ol>
      </div>
      
      <p>You can now close this window and check your Discord server!</p>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Mode: ${process.env.MODE || 'local'}`);
  
  // Initialize services
  await initializeServices();
  
  if (process.env.MODE === 'google-drive' && !authService?.isAuthenticated()) {
    console.log(`\n🔗 Please authenticate by visiting: http://localhost:${PORT}/auth/google`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  if (discordBot) {
    discordBot.stop();
  }
  
  process.exit(0);
});