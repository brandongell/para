# Documenso Template Integration

This document explains how to use the Documenso integration to upload templates and create reusable signing workflows.

## Overview

The legal document organizer now integrates with Documenso, allowing you to:
- Upload template documents to Documenso
- Get direct links to configure templates in Documenso's UI
- Track which templates have been uploaded
- Create reusable signing workflows for recurring documents

## Setup

### 1. Environment Variables

Add the following to your `.env` file:

```env
# Required
DOCUMENSO_API_URL=https://api.documenso.com  # or your self-hosted URL
DOCUMENSO_API_TOKEN=your_api_token_here

# Optional (defaults to https://app.documenso.com)
DOCUMENSO_APP_URL=https://app.documenso.com
```

### 2. Getting Your API Token

1. Log into your Documenso account
2. Go to Settings → API
3. Create a new API token
4. Copy the token to your `.env` file

## Discord Bot Commands

### Upload a Specific Template

```
User: "Upload employment agreement template to Documenso"
Bot: ✅ Template uploaded to Documenso!
     📄 Employment Agreement [TEMPLATE]
     🔗 Configure your template here:
     https://app.documenso.com/documents/123/convert-to-template
```

### Show Templates Not in Documenso

```
User: "Show templates not in Documenso"
Bot: 📄 Templates not yet uploaded to Documenso:
     1. Employment Agreement [TEMPLATE]
     2. NDA Form
     3. SAFE Agreement (Blank)
     
     To upload a template, say: "Upload [template name] to Documenso"
```

### Upload Templates from Search Results

```
User: "Find all templates"
Bot: [Shows template search results]

User: "Upload the first one to Documenso"
Bot: ✅ Template uploaded! Click here to configure...
```

## Workflow

### 1. Template Detection

Templates are automatically detected based on:
- Filename indicators: `[BLANK]`, `[FORM]`, `(Form)`, `Template`
- Manual marking via Discord commands
- AI classification during document processing

### 2. Upload Process

When you request to upload a template:

1. **System validates the document**
   - Must be a PDF file
   - Must be marked as template in metadata

2. **Upload to Documenso**
   - Creates a draft document in Documenso
   - Returns a configuration link

3. **Update metadata**
   - Tracks Documenso document ID
   - Stores template link
   - Updates status

### 3. Configure in Documenso

Click the provided link to:
- Add signature fields
- Configure recipient roles
- Set up email templates
- Enable direct links for public access

### 4. Use Your Template

Once configured in Documenso:
- Generate documents from templates via API
- Share direct links for self-service signing
- Track document status via webhooks

## Metadata Tracking

The system tracks Documenso integration in document metadata:

```json
{
  "filename": "Employment Agreement [TEMPLATE].pdf",
  "status": "template",
  "documenso": {
    "document_id": 123,
    "template_link": "https://app.documenso.com/documents/123/convert-to-template",
    "status": "uploaded",
    "uploaded_at": "2024-01-15T10:30:00Z"
  }
}
```

### Status Values

- `pending_upload` - Marked for upload but not yet sent
- `uploaded` - Successfully uploaded to Documenso
- `template_created` - Converted to reusable template
- `error` - Upload failed (see error_message)

## API Integration

### Create Document from Template

Once your template is configured, use the Documenso API:

```javascript
const response = await fetch(`${DOCUMENSO_API_URL}/api/v1/templates/${templateId}/generate-document`, {
  method: 'POST',
  headers: {
    'Authorization': DOCUMENSO_API_TOKEN,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: "Employment Agreement - John Doe",
    recipients: [
      { name: "John Doe", email: "john@example.com" },
      { name: "HR Manager", email: "hr@company.com" }
    ],
    formValues: {
      employeeName: "John Doe",
      salary: "$75,000",
      startDate: "2024-02-01"
    }
  })
});
```

## Best Practices

### 1. Template Naming
- Use clear, descriptive names
- Include `[TEMPLATE]` or similar indicator
- Specify document type (e.g., "Employment Agreement", "NDA")

### 2. Pre-Upload Checklist
- ✅ Document is a PDF
- ✅ All variable fields are clearly marked
- ✅ Document is the latest version
- ✅ No sensitive data in template

### 3. Field Placeholders
Before uploading, ensure your templates have clear placeholders:
- `[EMPLOYEE NAME]`
- `[START DATE]`
- `[SALARY]`
- `{{signature_1}}`

### 4. Version Control
- Keep templates in the `09_Templates` folder
- Update metadata when creating new versions
- Archive old templates before uploading new ones

## Troubleshooting

### Upload Failed

**Error: "Only PDF files can be uploaded to Documenso"**
- Solution: Convert document to PDF first

**Error: "Documenso integration is not configured"**
- Solution: Add API credentials to `.env` file

**Error: "Failed to upload to Documenso: 401"**
- Solution: Check your API token is valid

### Template Not Found

**Issue: Bot can't find your template**
- Ensure document is classified as template
- Try searching first: "Find all templates"
- Check the `09_Templates` folder

### Link Not Working

**Issue: Template configuration link returns 404**
- The link format may vary by Documenso version
- Check Documenso dashboard directly
- Document ID is included in metadata

## Advanced Usage

### Bulk Upload

```
User: "Upload all templates to Documenso"
Bot: Processing 5 templates...
     ✅ Employment Agreement - Uploaded
     ✅ NDA Form - Uploaded
     ❌ Contractor Agreement - Failed (not a PDF)
     ...
```

### Webhook Integration

Configure webhooks in Documenso to update document status:
1. Set webhook URL in Documenso settings
2. Handle events for document completion
3. Update local metadata accordingly

### Direct Links

For public templates (like NDAs):
1. Upload template to Documenso
2. Configure fields in Documenso UI
3. Enable direct link
4. Share link for self-service signing

## Security Considerations

- **API Token**: Keep your Documenso API token secure
- **Template Content**: Don't include sensitive data in templates
- **Access Control**: Limit who can upload templates
- **Audit Trail**: All uploads are logged in metadata

## Future Enhancements

Planned features:
- Automatic field detection in PDFs
- Bulk template management commands
- Template versioning support
- Webhook endpoint for status updates
- Direct link management via Discord

---

For more information about Documenso's API, visit: https://docs.documenso.com/developers/public-api