# Legal Document Organizer

An AI-powered legal document organizer that uses **Gemini multimodal AI** and **OpenAI GPT-4o** to automatically classify and organize legal documents with advanced PDF signature detection.

## 🎯 Key Features

- 🔮 **Gemini Multimodal PDF Extraction**: Revolutionary visual signature detection that finds ALL signers in PDFs
- 🤖 **Dual AI Classification**: Uses OpenAI GPT-4o for document classification and metadata extraction
- 📁 **Structured Organization**: Organizes documents into a 10-folder business function structure
- 👀 **Real-time Monitoring**: Continuously monitors folders for new files and organizes them instantly
- 📄 **Advanced PDF Processing**: Detects visual signatures, filled form fields, and annotations
- 🔄 **Batch Processing**: Can organize large numbers of existing files
- ⚡ **CLI Interface**: Simple command-line interface for easy use
- 🤖 **Discord Bot**: Optional Discord integration for document processing

## 🚀 What Makes This Special

This system uses **Google Gemini's multimodal capabilities** to analyze PDFs visually, not just as text. This breakthrough allows it to:

- ✅ **Find hidden signers**: Detects signatures that appear visual but aren't in the text layer
- ✅ **Extract complete metadata**: Names, addresses, emails, contract values, dates
- ✅ **Handle complex legal docs**: SAFE agreements, employment contracts, investment documents
- ✅ **Process annotations**: Stamps, form fields, electronic signatures

**Example Success**: On test document NMM.pdf, traditional extraction found only 1 signer (Dan Shipper), but Gemini finds both signers (Dan Shipper + Nashilu Mouen) with complete contact information.

## 📦 Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your API keys:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

## ⚙️ Configuration

Edit the `.env` file to configure:
```bash
# Required for document classification
OPENAI_API_KEY=your_openai_api_key_here

# Required for advanced PDF extraction
GEMINI_API_KEY=your_gemini_api_key_here

# Optional for Discord bot
DISCORD_BOT_TOKEN=your_discord_bot_token_here
ORGANIZE_FOLDER_PATH=/path/to/your/documents
```

## 🎮 Usage

### Quick Start (CLI)
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### Discord Bot
```bash
npm run discord
```

### Testing PDF Extraction
```bash
# Test Gemini multimodal extraction
npx ts-node test-gemini.ts

# Test simplified workflow
npx ts-node test-simplified-workflow.ts

# Test production workflow
npx ts-node test-production-workflow.ts
```

## 📁 Folder Structure

The organizer creates a structured folder system based on business functions:

- **01_Corporate_and_Governance** - Formation, governance, board documents
- **02_People_and_Employment** - Employment agreements, consulting, equity
- **03_Finance_and_Investment** - Investment documents, banking, tax
- **04_Sales_and_Revenue** - Customer agreements, sales contracts
- **05_Operations_and_Vendors** - Vendor agreements, supplier contracts
- **06_Technology_and_IP** - Patents, licenses, development agreements
- **07_Marketing_and_Partnerships** - Partnership agreements, marketing
- **08_Risk_and_Compliance** - Regulatory compliance, litigation
- **09_Templates** - Document templates and forms
- **10_Archive** - Expired or terminated documents

## 🔧 How It Works

### 1. PDF Processing with Gemini
- **Multimodal Analysis**: Gemini analyzes the entire PDF including visual elements
- **Signature Detection**: Finds both company and individual signatures
- **Metadata Extraction**: Extracts names, dates, addresses, contract values
- **Form Field Analysis**: Reads filled form fields that appear blank in text

### 2. Document Classification
- **AI Analysis**: GPT-4o analyzes document content for classification
- **Category Assignment**: Determines primary folder and subfolder
- **Confidence Scoring**: Provides classification confidence levels

### 3. Organization Workflow
1. **File Detection**: System detects new or existing files
2. **Content Extraction**: Uses appropriate extraction method (Gemini for PDFs)
3. **AI Classification**: Determines document category and destination
4. **File Movement**: Moves files to organized folder structure
5. **Metadata Generation**: Creates companion .metadata.json files
6. **Continuous Monitoring**: Watches for new files

## 📊 Supported Formats

- **PDF**: Advanced Gemini multimodal extraction
- **DOCX**: Microsoft Word documents
- **DOC**: Legacy Word documents  
- **TXT**: Plain text files

## 🎯 API Endpoints

If using the optional web server:
- **Health Check**: `GET /health`
- **Google Auth**: `GET /auth/google`
- **Organizations**: `GET /organizations`
- **Documents**: `GET /documents`

## 🔍 Advanced Features

### Metadata Schema
Each organized document gets a companion `.metadata.json` file with:
```json
{
  "filename": "document.pdf",
  "status": "executed",
  "category": "Investment_Fundraising",
  "signers": [
    {"name": "Dan Shipper", "date_signed": "2023-06-15"},
    {"name": "Nashilu Mouen", "date_signed": "2023-06-15"}
  ],
  "primary_parties": [...],
  "effective_date": "2023-06-15",
  "contract_value": "$50000",
  "governing_law": "Delaware"
}
```

### Process Management with Overmind
```bash
cd para/
./start.sh  # Starts all services
overmind ps # View running processes
```

## 🚨 Error Handling

- **Missing API Keys**: Graceful degradation with warnings
- **Unsupported Files**: Moved to default folder with error logging
- **Large Files**: Files >50MB ignored during monitoring
- **Duplicate Names**: Auto-resolved with counter suffixes
- **System Files**: Automatically ignored (.DS_Store, temp files)

## 🧪 Testing

The project includes comprehensive test scripts:
- `test-gemini.ts` - Test Gemini PDF extraction
- `test-simplified-workflow.ts` - Test streamlined processing
- `test-production-workflow.ts` - Test full production pipeline

## 📋 Requirements

- **Node.js 16+**
- **OpenAI API key** (for document classification)
- **Google Gemini API key** (for advanced PDF extraction)
- **Discord Bot Token** (optional, for Discord integration)

## 🏗️ Architecture

```
Legal Document Organizer
├── Core Services
│   ├── GeminiPdfService (multimodal PDF extraction)
│   ├── FileReaderService (file content extraction)
│   ├── MetadataService (metadata generation)
│   ├── DocumentClassifierService (AI classification)
│   └── FileOrganizerService (file organization)
├── Monitoring
│   └── FileMonitorService (real-time file watching)
├── Integrations
│   └── DiscordBotService (Discord bot interface)
└── Utilities
    └── CLIUtils (command-line interface)
```

## 🤝 Contributing

This project demonstrates advanced AI integration for legal document processing. Feel free to extend it with additional features or file formats.

## 📄 License

MIT License