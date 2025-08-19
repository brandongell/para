# Documenso URL Fix

## The Issue
The bot generated this URL:
```
https://app.documenso.com/documents/285591/convert-to-template
```

But you received a 404 error. Looking at the actual URL shown, it includes `/t/every/`:
```
https://app.documenso.com/t/every/documents/285591/convert-to-template
```

## Fixed Solution
I've updated the URL generation to use the simpler format:
```
https://app.documenso.com/documents/285591
```

This should take you to the document page where you can:
1. View the uploaded document
2. Add signature fields and text fields
3. Convert it to a reusable template

## Try This URL
Based on your document ID (285591), try accessing:
- https://app.documenso.com/documents/285591

If that doesn't work, you might need to:
1. Log into Documenso first
2. Navigate to your documents list
3. Find document ID 285591
4. Open it to configure as a template

## Updated Instructions
The bot now provides clearer instructions:
- It explains that the document is uploaded but needs template configuration
- It guides you through adding fields in Documenso
- It clarifies that the document must be saved as a template before sending

## Note
The URL format might depend on:
- Your Documenso account type (personal vs team)
- Your workspace settings
- The API version

If you're part of a team workspace called "every", the correct URL might include that path.