import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

async function testDocumensoTemplatesAPI() {
  console.log('🧪 Testing Documenso Templates API...\n');

  const apiUrl = process.env.DOCUMENSO_API_URL;
  const apiToken = process.env.DOCUMENSO_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    // Test 1: Try to get templates list
    console.log('📋 Test 1: Fetching templates list...');
    const templatesResponse = await fetch(`${apiUrl}/api/v1/templates`, {
      method: 'GET',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Response status: ${templatesResponse.status}`);
    if (templatesResponse.ok) {
      const templates = await templatesResponse.json();
      console.log('Templates found:', JSON.stringify(templates, null, 2));
    } else {
      console.log('Error response:', await templatesResponse.text());
    }

    // Test 2: Try to create a template directly
    console.log('\n📄 Test 2: Attempting to create template directly...');
    const createTemplateResponse = await fetch(`${apiUrl}/api/v1/templates`, {
      method: 'POST',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Template from API',
        type: 'template'
      })
    });

    console.log(`Response status: ${createTemplateResponse.status}`);
    const responseText = await createTemplateResponse.text();
    console.log('Response:', responseText);

    // Test 3: Check specific template
    console.log('\n🔍 Test 3: Checking template 5561...');
    const templateResponse = await fetch(`${apiUrl}/api/v1/templates/5561`, {
      method: 'GET',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Response status: ${templateResponse.status}`);
    if (templateResponse.ok) {
      const template = await templateResponse.json();
      console.log('Template details:', JSON.stringify(template, null, 2));
    } else {
      console.log('Error:', await templateResponse.text());
    }

    // Test 4: Check team templates endpoint
    console.log('\n👥 Test 4: Checking team templates endpoint...');
    const teamTemplatesResponse = await fetch(`${apiUrl}/api/v1/teams/every/templates`, {
      method: 'GET',
      headers: {
        'Authorization': apiToken,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Response status: ${teamTemplatesResponse.status}`);
    if (teamTemplatesResponse.ok) {
      const teamTemplates = await teamTemplatesResponse.json();
      console.log('Team templates:', JSON.stringify(teamTemplates, null, 2));
    } else {
      console.log('Error:', await teamTemplatesResponse.text());
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDocumensoTemplatesAPI().catch(console.error);