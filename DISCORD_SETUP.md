# Discord Bot Setup Guide

## Prerequisites

1. **Discord Application & Bot Token**
2. **OpenAI API Key**
3. **Organization Folder Path**

## Step 1: Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name your application (e.g., "Legal Document Organizer")
4. Go to the "Bot" section
5. Click "Add Bot"
6. Copy the **Bot Token** (you'll need this for the .env file)

## Step 2: Bot Permissions

In the Discord Developer Portal, under "Bot" section:

### Required Permissions:
- ✅ Send Messages
- ✅ Read Message History
- ✅ Use Slash Commands
- ✅ Attach Files
- ✅ Embed Links

### Required Intents:
- ✅ Message Content Intent
- ✅ Server Members Intent (optional)

## Step 3: Invite Bot to Server

1. Go to "OAuth2" > "URL Generator"
2. Select scopes: `bot` and `applications.commands`
3. Select the permissions listed above
4. Copy the generated URL and open it
5. Select your Discord server and authorize

## Step 4: Configure Environment Variables

Update your `.env` file:

```env
OPENAI_API_KEY=your_openai_api_key_here
DISCORD_BOT_TOKEN=your_discord_bot_token_here
ORGANIZE_FOLDER_PATH=/path/to/your/documents/folder
```

**Important:**
- `ORGANIZE_FOLDER_PATH` should be the absolute path to where you want documents organized
- The bot will create the folder structure automatically if it doesn't exist

## Step 5: Install Dependencies

```bash
npm install
```

## Step 6: Run the Discord Bot

```bash
npm run discord
```

## Usage Examples

Once the bot is running, you can interact with it naturally:

### File Organization
```
User: *uploads PDF* "Can you organize this contract?"
Bot: "I'll analyze and organize your contract right away! 📄"
Bot: "✅ Done! I've organized 'employment-agreement.pdf' into People & Employment > Employment Agreements..."
```

### Document Search
```
User: "Find all SAFE agreements that are executed"
Bot: "I found 8 executed SAFE agreements. Here are the recent ones:..."

User: "Show me documents signed by Nathan"
Bot: "Here are documents signed by Nathan:..."
```

### Document Information
```
User: "Tell me about the Bedrock SAFE agreement"
Bot: "The Bedrock Capital SAFE agreement:
      💰 Amount: $500,000
      📅 Executed: June 15, 2023..."
```

### Statistics
```
User: "What are our document statistics?"
Bot: "📊 Document Statistics:
      📁 Total Documents: 156
      ✅ Executed: 142
      📋 Templates: 8..."
```

## Troubleshooting

### Bot Not Responding
1. Check that the bot is online in your Discord server
2. Verify the bot has the correct permissions
3. Check the console for error messages

### Permission Errors
1. Make sure the bot has "Send Messages" permission in the channel
2. Verify "Message Content Intent" is enabled in Discord Developer Portal

### File Organization Issues
1. Check that `ORGANIZE_FOLDER_PATH` exists and is writable
2. Verify OpenAI API key is valid and has credits

### Rate Limiting
- The bot includes built-in rate limiting for OpenAI API calls
- Large batches of files may take time to process

## Security Notes

- **Never share your bot token publicly**
- Keep your `.env` file out of version control
- The bot only responds to messages in channels where it has permission
- All file processing happens locally - no files are sent to external services except OpenAI for text analysis

## Features

### Natural Language Processing
- No slash commands required
- Understands context and follow-up questions
- Handles file attachments automatically

### Multi-turn Conversations
- Remembers previous search results
- Can reference "that document" or "the first one"
- Context expires after 30 minutes

### Smart Search
- Search by document type, status, signer, date
- Relevance scoring for results
- Supports partial matches and variations

### Real-time Organization
- Immediate file processing upon upload
- Progress updates for multiple files
- Metadata extraction and storage

## API Costs

The bot uses OpenAI GPT-4o for:
- Intent recognition (~100 tokens per message)
- Document classification (~500 tokens per document)
- Metadata extraction (~1000 tokens per document)
- Response generation (~300 tokens per response)

Estimated cost: ~$0.01-0.05 per document processed.