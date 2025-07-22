import express from 'express';

const app = express();
const PORT = 8000;

// Handle Discord OAuth callback
app.get('/auth/discord/callback', (req, res) => {
  const { code, guild_id } = req.query;
  
  console.log('🎉 Discord OAuth callback received!');
  console.log('Authorization Code:', code);
  console.log('Guild ID (Server):', guild_id);
  
  // Send success page
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
          <li>Start the bot by running: <code>npm run discord</code></li>
          <li>Test the bot by uploading a document or asking questions</li>
        </ol>
      </div>
      
      <p>You can now close this window and check your Discord server!</p>
      
      <script>
        // Auto-close after 10 seconds
        setTimeout(() => {
          window.close();
        }, 10000);
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 OAuth callback server running on http://localhost:${PORT}`);
  console.log('Ready to handle Discord bot installations!');
});