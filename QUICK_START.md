# 🚀 Quick Start Guide

## Single Command Startup

To start the entire Legal Document Organizer system with all services, simply run:

```bash
npm run system
```

Or alternatively:

```bash
npm run
```

This will:
1. ✅ Build the TypeScript project
2. 📱 Start the Discord bot for natural language processing
3. 👀 Start the file monitor to auto-organize new documents
4. 🧠 Refresh the memory system
5. 🔐 Start the OAuth server for Google Drive integration

## What's Running?

- **Discord Bot** - Drop files in Discord or ask questions about documents
- **File Monitor** - Watches for new files and organizes them automatically
- **Memory System** - Maintains searchable knowledge base of all documents
- **OAuth Server** - Handles Google Drive authentication

## Useful Commands While Running

```bash
# View specific service logs
overmind connect discord    # Discord bot logs
overmind connect monitor    # File monitor logs
overmind connect memory     # Memory refresh logs

# Control services
overmind restart discord    # Restart Discord bot
overmind stop              # Stop a specific service
Ctrl+C                     # Stop all services
```

## Alternative Ways to Run

```bash
# Run services individually
npm run discord            # Just the Discord bot
npm run dev               # Just the file monitor
npm run refresh-memory    # Just refresh memory

# Run with Overmind directly
npm run overmind          # Start all services
npm run stop              # Stop all services
```

## First Time Setup

1. Copy `.env.example` to `.env`
2. Add your API keys:
   - `OPENAI_API_KEY` - Required for AI classification
   - `GEMINI_API_KEY` - Required for PDF extraction
   - `DISCORD_BOT_TOKEN` - Required for Discord bot
   - `DOCUMENSO_API_TOKEN` - Optional for template uploads

3. Run the system:
   ```bash
   npm run system
   ```

That's it! The system will handle everything else automatically.