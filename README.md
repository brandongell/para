# Legal Document Organizer

An AI-powered legal document organizer that uses **Gemini multimodal AI** and **OpenAI GPT-4o** to automatically classify and organize legal documents with advanced PDF signature detection.

## 🎯 Key Features

- 🔮 **Gemini Multimodal PDF Extraction**: Revolutionary visual signature detection that finds ALL signers in PDFs
- 🤖 **Dual AI Classification**: Uses OpenAI GPT-4o for document classification and metadata extraction
- 🧠 **Memory System**: Pre-indexes information for instant answers to business questions
- 📝 **Automatic Template Identification**: Intelligently identifies and categorizes template documents
- 📁 **Structured Organization**: Organizes documents into a 10-folder business function structure
- 👀 **Real-time Monitoring**: Continuously monitors folders for new files and organizes them instantly
- 📄 **Advanced PDF Processing**: Detects visual signatures, filled form fields, and annotations
- 🔄 **Batch Processing**: Can organize large numbers of existing files
- ⚡ **CLI Interface**: Simple command-line interface for easy use
- 🤖 **Discord Bot**: Natural language document search and template requests
- 🔗 **Documenso Integration**: Upload templates to Documenso for e-signature workflows

## 🚀 What Makes This Special

This system uses **Google Gemini's multimodal capabilities** to analyze PDFs visually, not just as text. This breakthrough allows it to:

- ✅ **Find hidden signers**: Detects signatures that appear visual but aren't in the text layer
- ✅ **Extract complete metadata**: Names, addresses, emails, contract values, dates
- ✅ **Handle complex legal docs**: SAFE agreements, employment contracts, investment documents
- ✅ **Process annotations**: Stamps, form fields, electronic signatures

**Example Success**: On test document NMM.pdf, traditional extraction found only 1 signer (Dan Shipper), but Gemini finds both signers (Dan Shipper + Nashilu Mouen) with complete contact information.

## 🧠 Memory System

The memory system pre-indexes all document information into aggregated markdown files for instant retrieval:

- **Company Information**: EIN, addresses, formation details, milestones
- **People Directory**: Employees, contractors, advisors, investors with contact info
- **Financial Summary**: Total capital raised ($1.8M+), investment rounds, SAFE agreements
- **Revenue & Sales**: Customer contracts, revenue streams, partnerships
- **Key Dates**: Contract expirations, renewal deadlines, vesting schedules

Memory files are automatically updated when new documents are added and enable instant answers via Discord.

## 📝 Template Identification & Documenso Integration

The system automatically identifies template documents using intelligent pattern matching:

- **High Confidence**: Documents with [BLANK], [FORM], (Form), or Template in filename
- **Medium Confidence**: Generic documents without specific party names
- **Smart Exclusion**: Won't mark EXECUTED or signed documents as templates

### 🆕 Automatic Documenso Upload Prompt

When a template is detected and Documenso is configured, the system will:
1. **Prompt you** to upload the template to Documenso
2. **Upload the document** if you confirm
3. **Return a configuration link** to set up signature fields
4. **Update metadata** with Documenso document ID and URL

Example prompt:
```
🎯 Template Document Detected!
📄 File: Employment Agreement [FORM].pdf
📋 Type: Employment Agreement
🏷️  Category: People_and_Employment
🔍 Confidence: HIGH

🤔 Would you like to upload this template to Documenso for configuration? (yes/no): yes

📤 Uploading template to Documenso...
✅ Template uploaded successfully!
🔗 Configure your template here:
   https://app.documenso.com/documents/12345/convert-to-template
📌 Document ID: 12345
💡 Tip: Add signature fields, text fields, and other elements in the Documenso interface.
```

Templates are:
- Automatically categorized with status: "template"
- Organized into the 09_Templates folder
- Searchable via Discord with natural language
- Tagged with metadata including placeholders and use cases

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

# Optional for Documenso integration
DOCUMENSO_API_URL=https://api.documenso.com
DOCUMENSO_API_TOKEN=your_documenso_api_token_here
DOCUMENSO_APP_URL=https://app.documenso.com
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

### Memory System
```bash
# Refresh memory files from all documents
npm run refresh-memory
```

The memory system creates pre-indexed markdown files that enable instant answers to questions like:
- "What is our EIN number?"
- "How much revenue do we have?"
- "Who are our investors?"
- "What contracts expire this month?"
- "Who are our key partners?"

### Discord Bot
```bash
npm run discord
```

#### Thread-Based Communication
The Discord bot uses a thread-based conversation model:
- **Activation**: Bot only responds when @mentioned (e.g., `@para help`)
- **Thread Creation**: Automatically creates a thread from your message
- **Continued Conversation**: In threads, no @ mention needed - just type naturally
- **Auto-Archive**: Threads archive after 24 hours of inactivity
- **Clean Channels**: Keeps main channels clutter-free

#### Template Commands
- "Show me all templates"
- "I need an employment agreement template"
- "Find SAFE template"
- "Get me a blank NDA"

#### File Organization
- Upload files with `@para organize this` to start a thread
- Bot processes files and responds with organization details in thread
- Multiple files are handled with progress updates

#### Documenso Integration
- "Upload this template to Documenso"
- "Show templates not in Documenso"
- "Upload employment agreement to Documenso"
- "Get Documenso link for NDA template"

### Testing PDF Extraction
```bash
# Test Gemini multimodal extraction
npx ts-node test-gemini.ts

# Test simplified workflow
npx ts-node test-simplified-workflow.ts

# Test production workflow
npx ts-node test-production-workflow.ts

# Test template identification
npx ts-node test-template-prompt.ts
npx ts-node test-mnda-form.ts
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
  "governing_law": "Delaware",
  "template_analysis": {
    "is_template": false,
    "confidence": "HIGH",
    "indicators": ["specific party names", "executed"]
  }
}
```

For templates:
```json
{
  "filename": "Employment Agreement [BLANK].pdf",
  "status": "template",
  "template_analysis": {
    "is_template": true,
    "confidence": "HIGH",
    "indicators": ["[BLANK] in filename"],
    "template_type": "Employment Agreement",
    "field_placeholders": ["[EMPLOYEE NAME]", "[START DATE]", "[SALARY]"],
    "typical_use_case": "Standard employment agreement for new hires"
  }
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