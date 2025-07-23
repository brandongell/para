#!/bin/bash

echo "🚀 Starting Legal Document Organizer System..."
echo ""

# Check if required environment variables are set
if [ -z "$OPENAI_API_KEY" ] && [ ! -f .env ]; then
    echo "❌ Missing environment configuration!"
    echo "Please ensure .env file exists with required API keys"
    exit 1
fi

# Build the project
echo "🔨 Building TypeScript project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Start all processes with Overmind
echo "🎯 Starting all services with Overmind..."
echo "  📱 Discord Bot - Natural language document processing"
echo "  👀 File Monitor - Auto-organize new documents"
echo "  🧠 Memory Refresh - Update knowledge base"
echo "  🔐 OAuth Server - Google Drive authentication"
echo ""
echo "📝 Commands while running:"
echo "  overmind connect discord - View Discord bot logs"
echo "  overmind connect monitor - View file monitor logs"
echo "  overmind restart <service> - Restart a specific service"
echo "  Ctrl+C - Stop all services"
echo ""

overmind start