# Documenso Template Integration

This document explains how to use the Documenso integration to upload templates and create reusable signing workflows.

## Overview

The legal document organizer now integrates with Documenso, allowing you to:
- Upload template documents to Documenso
- Get direct links to configure templates in Documenso's UI
- Track which templates have been uploaded
- Create reusable signing workflows for recurring documents
- **NEW**: Send templates for signature directly through Discord with interactive field collection

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

## 🚀 NEW: Discord Template Workflow - Send Documents for Signature

The most powerful feature of our Documenso integration is the ability to send templates for signature directly through Discord with an interactive, conversational workflow.

### How It Works

1. **Request to send a template** using natural language
2. **Para identifies the template** from your document library
3. **Interactive field collection** - Para asks for required information
4. **Review and confirm** before sending
5. **Document sent** with signing links provided

### Example Workflow

```
You: Send the MNDA to john@example.com

Para: I'll help you send the Mutual NDA template. Let me gather the required information.

**Field 1 of 2**
Please provide: **Company Name**
Example: Acme Corp

You: TechStart Inc.

Para: **Field 2 of 2**
Please provide: **Effective Date**
Example: YYYY-MM-DD

You: 2024-01-15

Para: Please review the information below and confirm with 'yes' to send:
📄 Ready to send: Mutual Non-Disclosure Agreement
- Company Name: TechStart Inc.
- Effective Date: 2024-01-15
👥 Recipients: John (john@example.com)

You: yes

Para: ✅ Document sent successfully!
📧 john@example.com - [Sign Document](https://app.documenso.com/sign/...)
```

### Supported Commands

- "Send the [template] to [email]" - Start a workflow with recipient
- "Send [name] the [template]" - Alternative phrasing
- "I need to send a [template type]" - Start workflow without recipient
- "Can you send the [template]" - Start workflow
- "[name/email] needs to sign the [template]" - Natural phrasing

### Field Collection Features

- **Smart validation**: Email addresses, dates, numbers are validated
- **Helpful prompts**: Each field shows examples and descriptions
- **Progress tracking**: See how many fields remain
- **Cancel anytime**: Type "cancel" to stop the workflow
- **Error recovery**: Invalid inputs show helpful error messages

### Prerequisites

1. **Template must be uploaded to Documenso**: Use "Upload [template] to Documenso" first
2. **Template fields must be configured**: Set up fields in Documenso UI
3. **Valid API credentials**: Ensure Documenso integration is configured

## 🎯 NEW: Automatic Template Upload Prompt

Para now automatically detects when you upload template files to Discord and offers to upload them to Documenso!

### How It Works

1. **Upload a template file** to Discord (PDF with template indicators)
2. **Para detects it's a template** during organization
3. **Prompts you to upload** to Documenso
4. **One-click upload** with "yes" or "upload to documenso"

### Example Workflow

```
User: [uploads MNDA_Form.pdf to Discord]

Para: ✅ Successfully organized 1 file!
      
      📄 File: MNDA_Form.pdf
      📁 Location: 09_Templates/Legal_Forms
      🎯 Category: Templates
      ⚡ Status: template
      
      📄 **Template Detected!**
      I noticed you uploaded a template: MNDA_Form.pdf
      
      Would you like me to upload it to Documenso so you can send it for signatures later? 
      Just reply with "yes" or "upload to documenso" and I'll set it up for you!

User: yes

Para: 📄 **Documenso Template Upload Results**

      ✅ **MNDA_Form.pdf**
         📄 Document ID: 456
         🔗 [Configure Template Fields](https://app.documenso.com/documents/456/convert-to-template)

      **Next Steps:**
      1. Click the links above to configure template fields in Documenso
      2. Once configured, you can send templates using commands like:
         • "Send the MNDA to john@example.com"
         • "Send employment agreement to new.hire@company.com"

      💡 **Tip:** Template configuration includes setting up signature fields, text fields, and recipient roles.
```

### Features

- **Automatic detection**: No need to manually identify templates
- **Batch support**: Upload multiple templates at once
- **Smart prompting**: Only prompts for actual templates
- **Metadata tracking**: Updates document metadata with Documenso IDs
- **Error handling**: Clear feedback if uploads fail

### When It Triggers

The upload prompt appears when:
- ✅ File has template indicators ([BLANK], [FORM], [TEMPLATE])
- ✅ File is classified as a template during organization
- ✅ Documenso integration is configured
- ✅ File is a PDF (required by Documenso)

The prompt does NOT appear for:
- ❌ Regular documents (not templates)
- ❌ Non-PDF files
- ❌ When Documenso is not configured

### Tips for Success

- **Prepare templates properly**: Add all required fields in Documenso
- **Use clear field names**: "Company Name" not "field_1"
- **Test first**: Try with your own email before sending to clients
- **Check template status**: Use "show templates" to see what's available

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