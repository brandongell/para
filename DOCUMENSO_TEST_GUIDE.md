# Documenso Integration Test Guide

## Quick Test Steps

### 1. Test Template Upload
```
1. In Discord, mention the bot with a template file:
   @Para organize this [attach MNDA Form2.pdf]

2. Bot should respond:
   - "I've organized your document"
   - "This appears to be a template. Would you like me to upload it to Documenso?"

3. Reply: yes

4. Bot should respond with:
   - "Documenso Template Upload Results"
   - Document ID and configuration link
   - Next steps instructions
```

### 2. Verify Upload
```bash
# Check metadata file
cat test-files-latest/09_Templates/By_Category/MNDA_Form2.pdf.metadata.json | grep documenso
```

Should show:
```json
"documenso": {
  "documentId": 285587,
  "template_id": "285587",
  "templateCreationUrl": "...",
  "uploadedAt": "...",
  "status": "draft"
}
```

### 3. Test Template Sending (after configuring in Documenso)
```
@Para send the MNDA to test@example.com
```

Bot should either:
- Ask to upload template first (if not uploaded)
- Start field collection workflow (if template is configured)

## Expected Results

✅ **Working Features:**
- Template detection during file upload
- Context preservation between messages
- Documenso API upload
- Metadata updates with template IDs
- Template registry recognition

⚠️ **Requires Manual Action:**
- Click template configuration link
- Set up fields in Documenso UI
- Convert document to template in Documenso

## Debug Commands

### Check Discord Bot Logs
Look for these key messages:
- `📋 Retrieved context for {ID}: Found with X pending uploads`
- `🔄 Using user context with pending uploads`
- `📤 Uploading template: {filename}`
- `✅ Document created: ID {number}`
- `✅ Updated metadata with Documenso info`

### Test API Directly
```bash
npx ts-node test-documenso-api.ts
```

### Test Workflow
```bash
npx ts-node test-template-send-workflow.ts
```

## Common Issues

### "Documenso integration is temporarily disabled"
- Check .env has DOCUMENSO_API_URL and DOCUMENSO_API_TOKEN
- Restart bot after adding credentials

### Bot doesn't remember pending uploads
- Fixed! Bot now checks both thread and user context
- Should work when replying "yes" in thread

### Template not found after upload
- Check metadata file has documenso.template_id
- Template registry refreshes automatically

## File Location
Your test file is at:
```
/Users/brandongell/Desktop/MNDA Form2.pdf
```