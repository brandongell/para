import { OpenAIService } from './openai';
import { FileReaderService } from './fileReader';
import { DocumentClassification, FileContent } from '../types';

export class DocumentClassifierService {
  private openaiService: OpenAIService;
  private fileReaderService: FileReaderService;

  constructor(openaiApiKey: string, geminiApiKey?: string) {
    this.openaiService = new OpenAIService(openaiApiKey);
    this.fileReaderService = new FileReaderService(geminiApiKey);
  }

  async classifyFile(filePath: string): Promise<DocumentClassification> {
    console.log(`📄 Reading file: ${filePath}`);
    
    // Check if file is supported
    if (!this.fileReaderService.isFileSupported(filePath)) {
      console.warn(`⚠️  Unsupported file type: ${filePath}`);
      return this.getDefaultClassification('Unsupported file type');
    }

    try {
      // Read file content
      const fileContent: FileContent = await this.fileReaderService.readFile(filePath);
      
      if (!fileContent.content || fileContent.content.trim().length === 0) {
        console.warn(`⚠️  Empty file content: ${filePath}`);
        return this.getDefaultClassification('Empty file content');
      }

      console.log(`🤖 Classifying document with AI...`);
      
      // Classify with AI
      const classification = await this.openaiService.classifyDocument(
        fileContent.content,
        fileContent.filename
      );

      console.log(`✅ Classification complete: ${classification.primaryFolder}/${classification.subfolder} (confidence: ${classification.confidence})`);
      console.log(`💭 Reasoning: ${classification.reasoning}`);

      return classification;
    } catch (error) {
      console.error(`❌ Error classifying file ${filePath}:`, error);
      
      // Fallback: Try to classify based on filename alone for templates
      const filename = require('path').basename(filePath);
      // Remove timestamp prefix if present (e.g., "1753216040008_MNDA_Form.pdf" -> "MNDA_Form.pdf")
      const cleanFilename = filename.replace(/^\d+_/, '');
      const templateIndicators = ['[BLANK]', '[FORM]', '(Form)', 'Form', 'FORM', 'Template', 'TEMPLATE', '_Form.', '_FORM.'];
      
      const isTemplate = templateIndicators.some(indicator => cleanFilename.includes(indicator));
      
      console.log(`🔍 Template detection fallback:`);
      console.log(`   - Original filename: ${filename}`);
      console.log(`   - Clean filename: ${cleanFilename}`);
      console.log(`   - Is template: ${isTemplate}`);
      
      if (isTemplate) {
        console.log(`📋 Detected template based on filename: ${filename}`);
        return {
          primaryFolder: '09_Templates',
          subfolder: 'By_Category',
          confidence: 0.8,
          reasoning: `Classified as template based on filename containing template indicator`
        };
      }
      
      return this.getDefaultClassification(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getDefaultClassification(reason: string): DocumentClassification {
    return {
      primaryFolder: '01_Corporate_and_Governance',
      subfolder: 'Unclassified',
      confidence: 0.1,
      reasoning: reason
    };
  }

  async batchClassify(filePaths: string[]): Promise<{ filePath: string; classification: DocumentClassification }[]> {
    const results: { filePath: string; classification: DocumentClassification }[] = [];
    
    console.log(`🔄 Starting batch classification of ${filePaths.length} files...`);

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      console.log(`\n📊 Progress: ${i + 1}/${filePaths.length}`);
      
      const classification = await this.classifyFile(filePath);
      results.push({ filePath, classification });
      
      // Small delay to avoid hitting API rate limits
      if (i < filePaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ Batch classification complete!`);
    return results;
  }
}