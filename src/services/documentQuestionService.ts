import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { FileReaderService } from './fileReader';

interface MemorySearchResult {
  file: string;
  sections: string[];
  documentPaths: string[];
}

interface DocumentContent {
  path: string;
  content: string;
}

export class DocumentQuestionService {
  private openai: OpenAI;
  private fileReader: FileReaderService;
  private organizeFolderPath: string;
  private memoryPath: string;

  constructor(openaiApiKey: string, organizeFolderPath: string, geminiApiKey?: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.fileReader = new FileReaderService(geminiApiKey);
    this.organizeFolderPath = organizeFolderPath;
    this.memoryPath = path.join(organizeFolderPath, 'memory');
  }

  /**
   * Answer a question by searching memory files and reading referenced documents
   */
  async answerQuestion(question: string): Promise<string> {
    console.log(`\n🤔 Processing question: "${question}"`);
    
    try {
      // Step 1: Search memory files for relevant information
      const memoryResults = await this.searchMemoryFiles(question);
      console.log(`📚 Found ${memoryResults.length} relevant memory sections`);
      
      // Step 2: Extract document paths from memory results
      const documentPaths = this.extractDocumentPaths(memoryResults);
      console.log(`📄 Found ${documentPaths.length} referenced documents`);
      
      // Step 3: Read the actual documents
      const documents = await this.readDocuments(documentPaths);
      console.log(`✅ Successfully read ${documents.length} documents`);
      
      // Step 4: Send everything to GPT-4 to answer the question
      const answer = await this.askGPT4(question, memoryResults, documents);
      
      return answer;
    } catch (error) {
      console.error('Error answering question:', error);
      throw error;
    }
  }

  /**
   * Search through memory files to find relevant sections
   */
  private async searchMemoryFiles(question: string): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    
    // Read all memory files
    if (!fs.existsSync(this.memoryPath)) {
      console.warn('Memory folder not found');
      return results;
    }
    
    const memoryFiles = fs.readdirSync(this.memoryPath)
      .filter(file => file.endsWith('.md'));
    
    // Use GPT-4 to identify relevant sections in each memory file
    for (const file of memoryFiles) {
      const filePath = path.join(this.memoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Skip empty files
      if (!content.trim()) continue;
      
      const prompt = `
Question: "${question}"

Memory File: ${file}
Content:
${content}

Task: Identify sections in this memory file that might help answer the question.
Return a JSON object with:
{
  "relevant": true/false,
  "sections": ["section 1 content", "section 2 content"],
  "documentPaths": ["path1", "path2"] // Extract any file paths mentioned
}

Focus on finding:
- Direct answers to the question
- Related information that provides context
- Document references that might contain the answer

Return only the JSON object, no other text.`;

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 1000
        });

        const result = response.choices[0]?.message?.content;
        if (result) {
          // Extract JSON from potential markdown code blocks
          let jsonStr = result.trim();
          if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          
          const parsed = JSON.parse(jsonStr);
          if (parsed.relevant && parsed.sections.length > 0) {
            results.push({
              file,
              sections: parsed.sections,
              documentPaths: parsed.documentPaths || []
            });
          }
        }
      } catch (error) {
        console.error(`Error processing memory file ${file}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Extract document paths from memory search results
   */
  private extractDocumentPaths(memoryResults: MemorySearchResult[]): string[] {
    const paths = new Set<string>();
    
    // Extract paths from memory results
    for (const result of memoryResults) {
      // Add explicitly found paths
      result.documentPaths.forEach(p => paths.add(p));
      
      // Also search for paths in the sections using regex
      const pathRegex = /([\/\w\-\s]+\.(pdf|docx|doc|txt))/gi;
      for (const section of result.sections) {
        const matches = section.matchAll(pathRegex);
        for (const match of matches) {
          // Try to resolve relative paths
          const potentialPath = match[1];
          
          // If it's just a filename, search for it in the organized folder
          if (!potentialPath.includes('/')) {
            const fullPath = this.findFileInOrganizedFolder(potentialPath);
            if (fullPath) {
              paths.add(fullPath);
            }
          } else {
            paths.add(potentialPath);
          }
        }
      }
    }
    
    return Array.from(paths);
  }

  /**
   * Find a file by name in the organized folder structure
   */
  private findFileInOrganizedFolder(filename: string): string | null {
    const searchDir = (dir: string): string | null => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !item.startsWith('.') && item !== 'memory') {
            const found = searchDir(fullPath);
            if (found) return found;
          } else if (stat.isFile()) {
            // Check if filename matches (case insensitive)
            if (item.toLowerCase() === filename.toLowerCase()) {
              return fullPath;
            }
            // Also check without metadata extension
            if (item.endsWith('.metadata.json')) {
              const baseFile = item.replace('.metadata.json', '');
              if (baseFile.toLowerCase() === filename.toLowerCase()) {
                // Return the actual file path, not the metadata path
                const actualFilePath = fullPath.replace('.metadata.json', '');
                if (fs.existsSync(actualFilePath)) {
                  return actualFilePath;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error searching directory ${dir}:`, error);
      }
      
      return null;
    };
    
    return searchDir(this.organizeFolderPath);
  }

  /**
   * Read document contents
   */
  private async readDocuments(paths: string[]): Promise<DocumentContent[]> {
    const documents: DocumentContent[] = [];
    
    for (const docPath of paths) {
      try {
        // Try absolute path first
        let fullPath = docPath;
        
        // If not absolute, try relative to organize folder
        if (!path.isAbsolute(docPath)) {
          fullPath = path.join(this.organizeFolderPath, docPath);
        }
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          console.warn(`Document not found: ${fullPath}`);
          continue;
        }
        
        // Read file content
        const fileContent = await this.fileReader.readFile(fullPath);
        const contentStr = typeof fileContent === 'string' ? fileContent : fileContent.content;
        documents.push({
          path: docPath,
          content: contentStr.substring(0, 10000) // Limit content length
        });
        
        console.log(`✅ Read document: ${path.basename(docPath)}`);
      } catch (error) {
        console.error(`Error reading document ${docPath}:`, error);
      }
    }
    
    return documents;
  }

  /**
   * Ask GPT-4 to answer the question based on memory and documents
   */
  private async askGPT4(
    question: string,
    memoryResults: MemorySearchResult[],
    documents: DocumentContent[]
  ): Promise<string> {
    // Build context from memory results
    const memoryContext = memoryResults.map(result => 
      `Memory File: ${result.file}\n${result.sections.join('\n')}`
    ).join('\n\n---\n\n');
    
    // Build context from documents
    const documentContext = documents.map(doc => 
      `Document: ${doc.path}\nContent:\n${doc.content}`
    ).join('\n\n---\n\n');
    
    const prompt = `
Question: ${question}

I've searched through memory files and documents to find information to answer this question.

MEMORY CONTEXT:
${memoryContext || 'No relevant memory sections found'}

DOCUMENT CONTEXT:
${documentContext || 'No documents found'}

Please answer the question based on the information provided above. 
- Be specific and direct
- Include relevant details like amounts, dates, names
- If the answer is not in the provided context, say so
- Keep the answer concise but complete

Answer:`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500
    });

    const answer = response.choices[0]?.message?.content;
    if (!answer) {
      throw new Error('No response from GPT-4');
    }
    
    return answer;
  }
}