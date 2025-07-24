import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryService } from './memoryService';
import { FileReaderService } from './fileReader';
import { MetadataService } from './metadataService';
import { DocumentMetadata } from '../types';

interface SearchContext {
  question: string;
  memoryResults: any[];
  candidateDocuments: string[];
  searchedDocuments: Set<string>;
  findings: Map<string, any>;
}

interface SearchTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export class ClaudeCodeSearchAgent {
  private anthropic: Anthropic;
  private memoryService: MemoryService;
  private fileReaderService: FileReaderService;
  private metadataService: MetadataService;
  private organizeFolderPath: string;
  private maxIterations: number;
  private tools: Map<string, SearchTool>;
  private searchProgress: string[] = [];

  constructor(
    organizeFolderPath: string,
    anthropicApiKey: string,
    geminiApiKey?: string
  ) {
    this.anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });
    
    this.organizeFolderPath = organizeFolderPath;
    this.memoryService = new MemoryService(organizeFolderPath);
    this.fileReaderService = new FileReaderService(geminiApiKey);
    this.metadataService = new MetadataService('', geminiApiKey); // We don't need OpenAI key for reading
    this.maxIterations = parseInt(process.env.CLAUDE_CODE_MAX_ITERATIONS || '10');
    
    // Initialize tools
    this.tools = new Map();
    this.initializeTools();
  }

  private initializeTools(): void {
    // Memory Search Tool
    this.tools.set('memory_search', {
      name: 'memory_search',
      description: 'Search through memory markdown files for relevant information',
      parameters: {
        query: { type: 'string', description: 'The search query' }
      },
      execute: async (params) => {
        const { query } = params;
        console.log(`🧠 Searching memory for: ${query}`);
        const result = await this.memoryService.queryMemory(query);
        return result || { answer: null, sources: [] };
      }
    });

    // Document Reader Tool
    this.tools.set('read_document', {
      name: 'read_document',
      description: 'Read the full content of a specific document',
      parameters: {
        filePath: { type: 'string', description: 'Path to the document to read' }
      },
      execute: async (params) => {
        const { filePath } = params;
        console.log(`📄 Reading document: ${filePath}`);
        
        try {
          const fullPath = path.isAbsolute(filePath) 
            ? filePath 
            : path.join(this.organizeFolderPath, filePath);
            
          if (!fs.existsSync(fullPath)) {
            return { error: `File not found: ${filePath}` };
          }
          
          const content = await this.fileReaderService.readFile(fullPath);
          return {
            path: filePath,
            content: typeof content === 'string' ? content : content.content,
            type: path.extname(filePath)
          };
        } catch (error) {
          return { error: `Failed to read document: ${error}` };
        }
      }
    });

    // Metadata Search Tool
    this.tools.set('search_metadata', {
      name: 'search_metadata',
      description: 'Search through document metadata files for specific information',
      parameters: {
        query: { type: 'string', description: 'What to search for in metadata' },
        field: { type: 'string', description: 'Optional: specific metadata field to search', optional: true }
      },
      execute: async (params) => {
        const { query, field } = params;
        console.log(`🔍 Searching metadata for: ${query}${field ? ` in field: ${field}` : ''}`);
        
        const results: any[] = [];
        await this.searchMetadataFiles(this.organizeFolderPath, query, field, results);
        return results;
      }
    });

    // Find Documents Tool
    this.tools.set('find_documents', {
      name: 'find_documents',
      description: 'Find documents by name, type, or location',
      parameters: {
        pattern: { type: 'string', description: 'Search pattern (supports wildcards)' },
        documentType: { type: 'string', description: 'Optional: document type filter', optional: true }
      },
      execute: async (params) => {
        const { pattern, documentType } = params;
        console.log(`🔎 Finding documents matching: ${pattern}`);
        
        const documents: string[] = [];
        await this.findDocuments(this.organizeFolderPath, pattern, documentType, documents);
        return documents;
      }
    });

    // Analyze Document Tool
    this.tools.set('analyze_document', {
      name: 'analyze_document',
      description: 'Perform deep analysis on a document to extract specific information',
      parameters: {
        filePath: { type: 'string', description: 'Path to the document' },
        question: { type: 'string', description: 'What specific information to extract' }
      },
      execute: async (params) => {
        const { filePath, question } = params;
        console.log(`🔬 Analyzing document ${filePath} for: ${question}`);
        
        try {
          const fullPath = path.isAbsolute(filePath) 
            ? filePath 
            : path.join(this.organizeFolderPath, filePath);
            
          const content = await this.fileReaderService.readFile(fullPath);
          const contentStr = typeof content === 'string' ? content : content.content;
          
          // Use Claude to analyze the document
          const analysis = await this.analyzeWithClaude(contentStr, question);
          return {
            document: filePath,
            analysis: analysis,
            contentLength: contentStr.length
          };
        } catch (error) {
          return { error: `Failed to analyze document: ${error}` };
        }
      }
    });

    // List Memory Files Tool
    this.tools.set('list_memory_files', {
      name: 'list_memory_files',
      description: 'List all available memory files and their topics',
      parameters: {},
      execute: async () => {
        console.log(`📚 Listing memory files`);
        
        const memoryDir = path.join(this.organizeFolderPath, 'memory');
        if (!fs.existsSync(memoryDir)) {
          return { error: 'Memory directory not found' };
        }
        
        const files = fs.readdirSync(memoryDir)
          .filter(f => f.endsWith('.md'))
          .map(f => {
            const content = fs.readFileSync(path.join(memoryDir, f), 'utf-8');
            const firstLine = content.split('\n')[0];
            return {
              file: f,
              title: firstLine.replace('#', '').trim(),
              size: content.length
            };
          });
          
        return files;
      }
    });

    // Read Memory Section Tool
    this.tools.set('read_memory_section', {
      name: 'read_memory_section',
      description: 'Read a specific section from a memory file',
      parameters: {
        memoryFile: { type: 'string', description: 'Memory file name (e.g., revenue_and_sales.md)' },
        section: { type: 'string', description: 'Section name to read', optional: true }
      },
      execute: async (params) => {
        const { memoryFile, section } = params;
        console.log(`📖 Reading memory file: ${memoryFile}${section ? `, section: ${section}` : ''}`);
        
        const memoryPath = path.join(this.organizeFolderPath, 'memory', memoryFile);
        if (!fs.existsSync(memoryPath)) {
          return { error: `Memory file not found: ${memoryFile}` };
        }
        
        const content = fs.readFileSync(memoryPath, 'utf-8');
        
        if (section) {
          // Extract specific section
          const lines = content.split('\n');
          let inSection = false;
          let sectionContent = [];
          
          for (const line of lines) {
            if (line.startsWith('## ') && line.includes(section)) {
              inSection = true;
              sectionContent.push(line);
            } else if (inSection && line.startsWith('## ')) {
              break;
            } else if (inSection) {
              sectionContent.push(line);
            }
          }
          
          return {
            file: memoryFile,
            section: section,
            content: sectionContent.join('\n') || `Section "${section}" not found`
          };
        }
        
        return {
          file: memoryFile,
          content: content
        };
      }
    });
  }

  async answerQuestion(question: string): Promise<string> {
    console.log(`\n🤖 Claude Code Search Agent starting search for: "${question}"`);
    this.searchProgress = []; // Reset progress
    this.addProgress(`Starting search for: "${question}"`);
    
    const context: SearchContext = {
      question,
      memoryResults: [],
      candidateDocuments: [],
      searchedDocuments: new Set(),
      findings: new Map()
    };

    try {
      // Step 1: Quick memory search
      console.log(`\n📍 Step 1: Checking memory files...`);
      this.addProgress('Checking memory files for quick answers...');
      const memoryResult = await this.memoryService.queryMemory(question);
      if (memoryResult) {
        context.memoryResults.push(memoryResult);
        context.findings.set('memory_search', memoryResult);
        console.log(`✅ Found relevant information in memory`);
        this.addProgress('Found relevant information in memory files');
      } else {
        console.log(`ℹ️  No direct memory match found`);
        this.addProgress('No direct memory match - starting deep search');
      }

      // Step 2: Let Claude Code take over with autonomous search
      console.log(`\n📍 Step 2: Starting Claude Code autonomous search...`);
      this.addProgress('Initiating Claude Code autonomous search...');
      const searchResult = await this.runAutonomousSearch(context);

      // Step 3: Format comprehensive answer
      console.log(`\n📍 Step 3: Formatting comprehensive answer...`);
      this.addProgress('Formatting comprehensive answer with sources');
      const answer = this.formatAnswer(searchResult, context);

      return answer;

    } catch (error) {
      console.error('❌ Error in Claude Code search:', error);
      this.addProgress(`Error: ${error}`);
      throw error;
    }
  }

  private addProgress(message: string): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const progressMessage = `[${timestamp}] ${message}`;
    this.searchProgress.push(progressMessage);
    console.log(`📊 ${progressMessage}`);
  }

  getSearchProgress(): string[] {
    return [...this.searchProgress];
  }

  private async runAutonomousSearch(context: SearchContext): Promise<string> {
    const systemPrompt = `You are an expert legal document search assistant with access to a comprehensive document repository. Your task is to find complete and accurate answers to questions by searching through documents, metadata, and pre-indexed memory files.

You have access to these tools:
${Array.from(this.tools.values()).map(tool => 
  `- ${tool.name}: ${tool.description}`
).join('\n')}

Initial context:
- Question: "${context.question}"
- Memory search results: ${context.memoryResults.length > 0 ? 'Found some relevant information' : 'No direct matches'}

Strategy:
1. First, analyze what information you already have from memory
2. Identify what additional information is needed
3. Search for and read relevant documents
4. Extract specific details that answer the question
5. Continue searching until you have a complete answer

Be thorough and persistent. Don't stop at the first piece of information - gather ALL relevant details.

Important: When you have gathered sufficient information to answer the question completely, respond with a summary starting with "FINAL ANSWER:".`;

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Please answer this question thoroughly: "${context.question}"

${context.memoryResults.length > 0 ? `Initial memory search found:
${JSON.stringify(context.memoryResults[0], null, 2)}` : 'No initial memory results found.'}

Use the available tools to find all relevant information. Be comprehensive.`
      }
    ];

    let iterations = 0;
    let finalAnswer = '';

    while (iterations < this.maxIterations && !finalAnswer) {
      iterations++;
      console.log(`\n🔄 Iteration ${iterations}/${this.maxIterations}`);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0,
        system: systemPrompt,
        messages: messages,
        tools: this.createToolDefinitions(),
      });

      // Process the response
      for (const content of response.content) {
        if (content.type === 'text') {
          console.log(`💭 Claude: ${content.text.substring(0, 200)}...`);
          
          // Check if this is the final answer
          if (content.text.includes('FINAL ANSWER:')) {
            finalAnswer = content.text.split('FINAL ANSWER:')[1].trim();
            break;
          }
        } else if (content.type === 'tool_use') {
          console.log(`🔧 Using tool: ${content.name}`);
          this.addProgress(`Using tool: ${content.name}`);
          
          // Execute the tool
          const tool = this.tools.get(content.name);
          if (tool) {
            try {
              const result = await tool.execute(content.input);
              
              // Log tool-specific progress
              if (content.name === 'read_document' && (content.input as any).filePath) {
                this.addProgress(`Reading document: ${(content.input as any).filePath}`);
              } else if (content.name === 'search_metadata' && (content.input as any).query) {
                this.addProgress(`Searching metadata for: ${(content.input as any).query}`);
              } else if (content.name === 'analyze_document' && (content.input as any).question) {
                this.addProgress(`Analyzing document for: ${(content.input as any).question}`);
              }
              
              // Add tool result to messages
              messages.push({
                role: 'assistant',
                content: response.content
              });
              
              messages.push({
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: content.id,
                  content: JSON.stringify(result, null, 2)
                }]
              });
              
              // Store findings
              context.findings.set(`${content.name}_${iterations}`, result);
              
              // Track searched documents
              if (content.name === 'read_document' && content.input && (content.input as any).filePath) {
                context.searchedDocuments.add((content.input as any).filePath);
              }
            } catch (error) {
              console.error(`❌ Tool error:`, error);
              messages.push({
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: content.id,
                  content: `Error: ${error}`
                }]
              });
            }
          }
          
          // Continue the conversation
          break;
        }
      }

      // If we have a complete message without tool use, add it to history
      if (response.content.every(c => c.type === 'text')) {
        messages.push({
          role: 'assistant',
          content: response.content.map(c => c.type === 'text' ? c.text : '').join('\n')
        });
      }
    }

    if (!finalAnswer) {
      console.log(`⚠️  Max iterations reached without final answer`);
      // Compile what we found
      finalAnswer = this.compileFindings(context);
    }

    return finalAnswer;
  }

  private createToolDefinitions(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters,
        required: Object.keys(tool.parameters).filter(key => !tool.parameters[key].optional)
      }
    }));
  }

  private async searchMetadataFiles(
    dirPath: string, 
    query: string, 
    field: string | undefined,
    results: any[]
  ): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item !== 'memory') {
        await this.searchMetadataFiles(fullPath, query, field, results);
      } else if (item.endsWith('.metadata.json')) {
        try {
          const metadata = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          const documentPath = fullPath.replace('.metadata.json', '');
          
          // Search in specific field or all fields
          if (field) {
            const value = this.getNestedValue(metadata, field);
            if (value && String(value).toLowerCase().includes(query.toLowerCase())) {
              results.push({
                document: path.relative(this.organizeFolderPath, documentPath),
                field: field,
                value: value,
                metadata: metadata
              });
            }
          } else {
            // Search all fields
            if (JSON.stringify(metadata).toLowerCase().includes(query.toLowerCase())) {
              results.push({
                document: path.relative(this.organizeFolderPath, documentPath),
                metadata: metadata
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to read metadata: ${fullPath}`);
        }
      }
    }
  }

  private async findDocuments(
    dirPath: string,
    pattern: string,
    documentType: string | undefined,
    documents: string[]
  ): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item !== 'memory') {
        await this.findDocuments(fullPath, pattern, documentType, documents);
      } else if (stat.isFile() && !item.endsWith('.metadata.json')) {
        // Check pattern match
        const matches = item.toLowerCase().includes(pattern.toLowerCase()) ||
                       fullPath.toLowerCase().includes(pattern.toLowerCase());
        
        // Check document type if specified
        const typeMatches = !documentType || 
                           path.extname(item).toLowerCase() === `.${documentType.toLowerCase()}`;
        
        if (matches && typeMatches) {
          documents.push(path.relative(this.organizeFolderPath, fullPath));
        }
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async analyzeWithClaude(content: string, question: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0,
      system: 'You are analyzing a legal document to extract specific information. Be precise and thorough.',
      messages: [
        {
          role: 'user',
          content: `Analyze this document and answer: ${question}\n\nDocument content:\n${content.substring(0, 10000)}`
        }
      ]
    });

    return response.content
      .filter(c => c.type === 'text')
      .map(c => (c as any).text)
      .join('\n');
  }

  private compileFindings(context: SearchContext): string {
    let answer = `Based on my search through ${context.searchedDocuments.size} documents:\n\n`;
    
    // Add key findings
    for (const [source, data] of context.findings) {
      if (data && typeof data === 'object' && !data.error) {
        answer += `**From ${source}:**\n`;
        if (data.answer) {
          answer += `${data.answer}\n\n`;
        } else if (data.analysis) {
          answer += `${data.analysis}\n\n`;
        } else if (Array.isArray(data) && data.length > 0) {
          answer += `Found ${data.length} relevant items\n\n`;
        }
      }
    }
    
    if (context.searchedDocuments.size > 0) {
      answer += `\n**Documents searched:**\n`;
      context.searchedDocuments.forEach(doc => {
        answer += `- ${doc}\n`;
      });
    }
    
    return answer;
  }

  private formatAnswer(searchResult: string, context: SearchContext): string {
    // Add source citations
    let formattedAnswer = searchResult;
    
    if (context.searchedDocuments.size > 0) {
      formattedAnswer += `\n\n📚 **Sources:**\n`;
      let sourceNum = 1;
      context.searchedDocuments.forEach(doc => {
        formattedAnswer += `${sourceNum}. ${doc}\n`;
        sourceNum++;
      });
    }
    
    return formattedAnswer;
  }
}