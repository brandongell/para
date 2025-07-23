# Fresh Test Setup Instructions

This guide explains how to test the legal document organizer with a completely fresh set of files.

## How It Works

The system is designed to handle fresh starts perfectly:

1. **Memory files are overwritten** - Each time you run `refresh-memory`, it completely regenerates all memory files based on the current documents
2. **Folder-based isolation** - Each folder you organize has its own memory system
3. **No cross-contamination** - Different projects don't interfere with each other

## Steps to Test Fresh

### 1. Create a New Test Directory
```bash
mkdir fresh-test-documents
```

### 2. Add Your Test Files
Copy your new legal documents into the `fresh-test-documents` folder.

### 3. Update Environment Variable
Edit `.env` file:
```
ORGANIZE_FOLDER_PATH=/full/path/to/fresh-test-documents
```

### 4. Run the Organizer
```bash
npm run build
npm start
```

Choose "Yes" when asked to organize existing files.

### 5. Generate Fresh Memory
```bash
npm run refresh-memory
```

This will create a new `memory/` folder next to `fresh-test-documents/` with completely fresh memory files based only on your new documents.

### 6. Test Discord Bot (Optional)
```bash
npm run discord
```

The bot will use the fresh memory files for this new set of documents.

## What Happens

- New organized folders (01_Corporate_and_Governance, etc.) will be created
- Fresh memory files will be generated in `fresh-test-documents/../memory/`
- All metadata will be based only on the new documents
- Previous organization and memory from other folders remain untouched

## Cleanup (Optional)

To completely start over:
```bash
rm -rf fresh-test-documents/0*_*  # Remove organized folders
rm -rf memory/                     # Remove memory files
```

## Multiple Projects

You can have multiple independent projects:
- `project1/` with its own `../memory/`
- `project2/` with its own `../memory/`
- Each completely isolated from the other