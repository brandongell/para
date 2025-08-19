import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

// Load environment variables
dotenv.config();

async function testCreateTemplate() {
  console.log('🧪 Testing Documenso Template Creation...\n');

  const apiUrl = process.env.DOCUMENSO_API_URL;
  const apiToken = process.env.DOCUMENSO_API_TOKEN;
  const testFilePath = '/Users/brandongell/Desktop/MNDA Form2.pdf';

  if (!apiUrl || !apiToken) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    // Method 1: Try creating with type parameter
    console.log('📄 Method 1: Creating document with type: "template"...');
    const createPayload1 = {
      title: 'Test Template Method 1',
      type: 'template',
      recipients: []
    };

    const response1 = await fetch(`${apiUrl}/api/v1/documents`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createPayload1)
    });

    console.log(`Response status: ${response1.status}`);
    const result1 = await response1.text();
    console.log('Response:', result1);

    // Method 2: Try creating a document and converting it
    console.log('\n📄 Method 2: Check if document can be converted to template...');
    
    // First create a regular document
    const createDoc = await fetch(`${apiUrl}/api/v1/documents`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Document for Template Conversion',
        recipients: []
      })
    });

    if (createDoc.ok) {
      const doc = await createDoc.json() as any;
      console.log('Document created:', doc);

      // Try to convert to template
      const convertUrl = `${apiUrl}/api/v1/documents/${doc.documentId}/convert-to-template`;
      console.log(`\nTrying to convert at: ${convertUrl}`);
      
      const convertResponse = await fetch(convertUrl, {
        method: 'POST',
        headers: {
          'Authorization': apiToken,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Convert response status: ${convertResponse.status}`);
      const convertResult = await convertResponse.text();
      console.log('Convert response:', convertResult);
    }

    // Method 3: Check template-specific endpoints
    console.log('\n📄 Method 3: Checking template upload endpoint...');
    
    // Create form data with file
    const formData = new FormData();
    formData.append('title', 'Test Template Direct Upload');
    formData.append('file', fs.createReadStream(testFilePath));

    // Try template upload endpoint
    const templateUploadResponse = await fetch(`${apiUrl}/api/v1/templates/upload`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken
      },
      body: formData
    });

    console.log(`Template upload response status: ${templateUploadResponse.status}`);
    const templateUploadResult = await templateUploadResponse.text();
    console.log('Template upload response:', templateUploadResult);

    // Method 4: Check if we can create template with file in one step
    console.log('\n📄 Method 4: Create template with multipart form...');
    
    const formData2 = new FormData();
    formData2.append('data', JSON.stringify({
      title: 'Test Template Multipart',
      type: 'TEMPLATE',
      templateType: 'PRIVATE'
    }));
    formData2.append('file', fs.createReadStream(testFilePath));

    const multipartResponse = await fetch(`${apiUrl}/api/v1/templates`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken
      },
      body: formData2
    });

    console.log(`Multipart response status: ${multipartResponse.status}`);
    const multipartResult = await multipartResponse.text();
    console.log('Multipart response:', multipartResult);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCreateTemplate().catch(console.error);