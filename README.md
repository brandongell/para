# Legal Document Organizer

An AI-powered legal document organizer that uses OpenAI GPT-4o to automatically classify and organize legal documents into a structured folder system.

## Features

- 🤖 **AI-Powered Classification**: Uses OpenAI GPT-4o to analyze document content and classify documents
- 📁 **Structured Organization**: Organizes documents into a 10-folder business function structure
- 👀 **Real-time Monitoring**: Continuously monitors folders for new files and organizes them instantly
- 📄 **Multi-format Support**: Handles PDF, DOCX, DOC, and TXT files
- 🔄 **Batch Processing**: Can organize large numbers of existing files
- ⚡ **CLI Interface**: Simple command-line interface for easy use

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your OpenAI API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## Folder Structure

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

## How It Works

1. **Initial Organization**: The tool scans your folder for existing files and organizes them
2. **AI Classification**: Each document is analyzed by GPT-4o to determine its category and subcategory
3. **File Movement**: Files are moved (not copied) to the appropriate organized folders
4. **Continuous Monitoring**: The tool watches for new files and organizes them automatically

## Requirements

- Node.js 16+ 
- OpenAI API key
- Supported file formats: PDF, DOCX, DOC, TXT

## Configuration

Edit the `.env` file to configure:
- `OPENAI_API_KEY`: Your OpenAI API key

## Error Handling

- Files that cannot be read are placed in the default folder with error logging
- Duplicate filenames are handled by adding a counter suffix
- Large files (>50MB) are ignored during monitoring
- System files (.DS_Store, temp files) are automatically ignored

## License

MIT License