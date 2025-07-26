import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

async function testTemplate5561() {
  console.log('🧪 Testing how template 5561 was created...\n');

  const apiUrl = process.env.DOCUMENSO_API_URL;
  const apiToken = process.env.DOCUMENSO_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    // Get template details
    console.log('📋 Fetching template 5561 details...');
    const templateResponse = await fetch(`${apiUrl}/api/v1/templates/5561`, {
      method: 'GET',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      }
    });

    if (templateResponse.ok) {
      const template = await templateResponse.json() as any;
      console.log('Template details:', JSON.stringify(template, null, 2));

      // Check if there's a corresponding document
      if (template.externalId || template.documentId) {
        console.log('\n📄 Checking for corresponding document...');
        const docId = template.externalId || template.documentId;
        const docResponse = await fetch(`${apiUrl}/api/v1/documents/${docId}`, {
          method: 'GET',
          headers: {
            'Authorization': apiToken,
            'Content-Type': 'application/json'
          }
        });

        console.log(`Document ${docId} response status:`, docResponse.status);
        if (docResponse.ok) {
          const doc = await docResponse.json();
          console.log('Document details:', JSON.stringify(doc, null, 2));
        }
      }

      // Test using the template
      console.log('\n🚀 Testing template usage...');
      const testPayload = {
        title: 'Test document from template 5561',
        recipients: [
          {
            name: 'Test Recipient',
            email: 'test@example.com',
            role: 'SIGNER'
          }
        ]
      };

      const useTemplateResponse = await fetch(`${apiUrl}/api/v1/templates/5561/generate-document`, {
        method: 'POST',
        headers: {
          'Authorization': apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      console.log(`Generate document response status: ${useTemplateResponse.status}`);
      const useResult = await useTemplateResponse.text();
      console.log('Response:', useResult);

      // Try alternative endpoint
      console.log('\n🚀 Testing alternative endpoint...');
      const altResponse = await fetch(`${apiUrl}/api/v1/templates/5561/create-document`, {
        method: 'POST',
        headers: {
          'Authorization': apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      console.log(`Create document response status: ${altResponse.status}`);
      const altResult = await altResponse.text();
      console.log('Response:', altResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testTemplate5561().catch(console.error);