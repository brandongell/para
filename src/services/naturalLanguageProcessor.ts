import OpenAI from 'openai';
import { BotIntent, ConversationContext, BotResponse } from '../types';

export class NaturalLanguageProcessor {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async processMessage(
    message: string, 
    hasAttachments: boolean, 
    context?: ConversationContext
  ): Promise<BotIntent> {
    const systemPrompt = this.buildIntentSystemPrompt();
    const userPrompt = this.buildIntentUserPrompt(message, hasAttachments, context);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return this.parseIntentResult(result);
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        type: 'UNKNOWN',
        confidence: 0.1,
        parameters: {}
      };
    }
  }

  async generateResponse(
    intent: BotIntent,
    data: any,
    context?: ConversationContext
  ): Promise<BotResponse> {
    const systemPrompt = this.buildResponseSystemPrompt();
    const userPrompt = this.buildResponseUserPrompt(intent, data, context);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return this.parseResponseResult(result);
    } catch (error) {
      console.error('Error generating response:', error);
      return {
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        followUpSuggestions: ["Try uploading a file", "Ask me to search for documents"]
      };
    }
  }

  private buildIntentSystemPrompt(): string {
    return `You are analyzing Discord messages to determine user intent for a legal document management system.

POSSIBLE INTENTS:
1. ORGANIZE_FILES - User wants to organize attached files or is uploading files
2. SEARCH_DOCUMENTS - User wants to find specific documents
3. REQUEST_TEMPLATE - User specifically wants templates or blank forms
4. GET_DOCUMENT_INFO - User wants details about a specific document
5. LIST_DOCUMENTS - User wants to see documents by category/status
6. GET_STATISTICS - User wants organizational stats or summaries
7. HELP - User needs assistance or asks how to use the system
8. UPLOAD_TO_DOCUMENSO - User wants to upload templates to Documenso for e-signatures
9. SEND_TEMPLATE - User wants to send a template to someone for signature

PARAMETER EXTRACTION:
For each intent, extract relevant parameters:

SEARCH_DOCUMENTS parameters:
- document_type: SAFE, employment, NDA, contract, agreement, etc.
- status: executed, template, draft, partially_executed
- signer: Names of people who signed
- date_range: {start: "YYYY-MM-DD", end: "YYYY-MM-DD"}
- company: Company/organization names
- category: corporate, employment, investment, etc.
- query: The natural language search query

FACT-BASED QUERIES (still use SEARCH_DOCUMENTS intent):
- "What is our EIN?" → query: "EIN number"
- "How much revenue do we have?" → query: "revenue"
- "Who are our investors?" → query: "investors"
- "What's our address?" → query: "company address"
- "How much did [investor] invest?" → query: "[investor] investment amount"

REQUEST_TEMPLATE parameters:
- template_type: employment, SAFE, NDA, service agreement, stock option, etc.
- category: Business category if specified

Template request indicators:
- "template", "form", "blank", "reusable"
- "I need a template for..."
- "Show me templates"
- "Find [type] template"
- "Get me a blank [document type]"

GET_DOCUMENT_INFO parameters:
- filename: Specific document name mentioned

LIST_DOCUMENTS parameters:
- document_type: Type to filter by
- status: Status to filter by
- category: Category to filter by

UPLOAD_TO_DOCUMENSO parameters:
- filename: Specific document/template name to upload
- template_type: Type of template if specified

Documenso upload indicators:
- "upload to documenso", "send to documenso", "create documenso template"
- "documenso link", "get documenso link"
- "upload template", "upload this template"
- "templates not in documenso", "show unuploaded templates"
- "make this a signing template"

SEND_TEMPLATE parameters:
- template_name: Name or type of template to send (e.g., "MNDA", "employment agreement")
- recipient_email: Email address to send to
- recipient_name: Name of recipient if provided

Send template indicators:
- "send the [template] to [email]"
- "send [name] the [template]"
- "I need to send a [template type]"
- "can you send the [template]"
- "prepare [template] for [name/email]"
- "[name/email] needs to sign the [template]"

CONTEXT AWARENESS:
- If user has previous search results, they might be asking follow-up questions
- Consider conversation flow for better intent detection
- "That one" or "the first one" refers to previous results

RESPONSE FORMAT:
Always respond with JSON:
{
  "type": "INTENT_NAME",
  "confidence": 0.85,
  "parameters": {
    "document_type": "SAFE agreement",
    "status": "executed"
  }
}

EXAMPLES:
"Can you organize this contract?" + file attachment → ORGANIZE_FILES
"Find all SAFE agreements that are executed" → SEARCH_DOCUMENTS
"Show me employment documents from 2023" → SEARCH_DOCUMENTS
"Tell me about that Bedrock SAFE agreement" → GET_DOCUMENT_INFO
"What's our document stats?" → GET_STATISTICS
"How do I use this?" → HELP
"Tell me more about the first one" (with context) → GET_DOCUMENT_INFO
"Upload this template to Documenso" → UPLOAD_TO_DOCUMENSO
"Show templates not in Documenso" → UPLOAD_TO_DOCUMENSO
"Get Documenso link for employment agreement" → UPLOAD_TO_DOCUMENSO
"Send the MNDA to john@example.com" → SEND_TEMPLATE
"Send John Smith the employment agreement" → SEND_TEMPLATE
"I need to send a SAFE to investor@vc.com" → SEND_TEMPLATE
"Can you send the NDA to our new vendor?" → SEND_TEMPLATE
"What is our EIN number?" → SEARCH_DOCUMENTS (query: "EIN number")
"How much revenue do we have?" → SEARCH_DOCUMENTS (query: "revenue")
"Who invested in our company?" → SEARCH_DOCUMENTS (query: "investors")`;
  }

  private buildIntentUserPrompt(
    message: string, 
    hasAttachments: boolean, 
    context?: ConversationContext
  ): string {
    let prompt = `Message: "${message}"\nHas Attachments: ${hasAttachments}`;
    
    if (context && context.lastIntent) {
      prompt += `\nPrevious Intent: ${context.lastIntent.type}`;
      prompt += `\nPrevious Query: ${context.lastQuery || 'none'}`;
      prompt += `\nAwaiting Follow-up: ${context.awaitingFollowUp}`;
    }
    
    prompt += '\n\nAnalyze this message and determine the user intent with parameters as JSON.';
    
    return prompt;
  }

  private buildResponseSystemPrompt(): string {
    return `You are a friendly, professional legal document management assistant. Your job is to generate conversational responses based on user intents and data results.

PERSONALITY:
- Professional but approachable
- Concise and clear communication
- Use appropriate emojis for visual clarity
- Proactive with helpful suggestions
- Confident about legal document knowledge

RESPONSE GUIDELINES:

For ORGANIZE_FILES results:
- For single file: Show clear success/failure without mentioning "other instances"
- For successful files: Celebrate and show where placed with full path
- For failed files: Explain the specific error clearly
- Handle mixed success/failure gracefully for multiple files only
- Show key metadata (status, signers, dates) for successful files
- Be clear about what succeeded vs what failed
- NEVER mention "another instance" or "second instance" unless there are actually multiple files
- If only one file was uploaded, give a simple success or failure message

For SEARCH_DOCUMENTS results:
- If result includes notes field with memory answer, present that FIRST and prominently
- For memory/fact-based queries (EIN, revenue, etc.), highlight the answer clearly
- Present results in an organized, scannable format
- Use bullet points or numbered lists
- Show most relevant information first
- Offer to narrow down or get details on specific items
- If no results, suggest alternative searches

For GET_DOCUMENT_INFO:
- Present metadata in a clear, structured way
- Highlight important details (amounts, dates, parties)
- Use formatting to make information easy to scan
- Offer related actions (find similar docs, etc.)

For LIST_DOCUMENTS:
- Group results logically
- Show counts and summaries
- Use clear categorization
- Offer filtering options

For GET_STATISTICS:
- Present numbers in context
- Use visual formatting
- Highlight interesting insights
- Offer drill-down options

For HELP:
- Be comprehensive but not overwhelming
- Use examples
- Encourage experimentation

FORMATTING:
- Use Discord markdown formatting
- **Bold** for emphasis
- • Bullet points for lists
- \`code\` for filenames
- Emojis for visual hierarchy (📄 📁 ✅ ❌ 📊 🔍)

FOLLOW-UP SUGGESTIONS:
Always include 1-3 natural follow-up suggestions that the user might want to do next.

RESPONSE FORMAT:
Always respond with JSON:
{
  "content": "Your response message here with Discord markdown",
  "followUpSuggestions": [
    "Try searching for specific document types",
    "Upload more files to organize"
  ]
}`;
  }

  private buildResponseUserPrompt(
    intent: BotIntent,
    data: any,
    context?: ConversationContext
  ): string {
    let prompt = `Intent: ${intent.type}\nParameters: ${JSON.stringify(intent.parameters)}\n`;
    
    if (data) {
      prompt += `Data: ${JSON.stringify(data, null, 2)}\n`;
    }
    
    if (context) {
      prompt += `Context: Previous query was "${context.lastQuery}"\n`;
    }
    
    prompt += '\nGenerate a conversational response as JSON with content and followUpSuggestions.';
    
    return prompt;
  }

  private parseIntentResult(result: string): BotIntent {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        type: parsed.type || 'UNKNOWN',
        confidence: parsed.confidence || 0.5,
        parameters: parsed.parameters || {}
      };
    } catch (error) {
      console.error('Error parsing intent result:', error);
      return {
        type: 'UNKNOWN',
        confidence: 0.1,
        parameters: {}
      };
    }
  }

  private parseResponseResult(result: string): BotResponse {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        content: parsed.content || "I'm not sure how to respond to that.",
        followUpSuggestions: parsed.followUpSuggestions || []
      };
    } catch (error) {
      console.error('Error parsing response result:', error);
      return {
        content: "I apologize, but I encountered an error generating a response.",
        followUpSuggestions: ["Try asking again", "Upload a file to organize"]
      };
    }
  }
}