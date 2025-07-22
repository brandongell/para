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
echo "  💻 CLI Interface - Direct file processing"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

overmind start