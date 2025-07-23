import * as fs from 'fs';
import * as path from 'path';
import { BotIntent, SearchResult, DocumentMetadata } from '../types';
import { MemoryService } from './memoryService';

export class SmartSearchService {
  private organizedFolderPath: string;
  private memoryService: MemoryService;

  constructor(organizedFolderPath: string) {
    this.organizedFolderPath = organizedFolderPath;
    this.memoryService = new MemoryService(organizedFolderPath);
  }

  async searchByNaturalLanguage(intent: BotIntent): Promise<SearchResult[]> {
    console.log(`🔍 Performing search with intent: ${intent.type}`);
    console.log(`📋 Parameters:`, intent.parameters);

    // Check memory first for quick answers if query is provided
    if (intent.parameters.query) {
      console.log(`🧠 Checking memory for quick answer...`);
      const memoryResult = await this.memoryService.queryMemory(intent.parameters.query);
      
      if (memoryResult) {
        console.log(`✅ Found answer in memory!`);
        // Create a single memory result with the answer
        const memorySearchResult: SearchResult = {
          filename: 'Memory Search Result',
          path: 'memory',
          metadata: {
            filename: 'Memory Search Result',
            status: 'executed' as const,
            category: 'Memory',
            signers: [],
            fully_executed_date: null,
            notes: memoryResult.answer,
            tags: memoryResult.sources
          },
          relevanceScore: 1.0
        };
        
        // Continue with regular search to find more details
        // but return memory result first
        const regularResults = await this.performRegularSearch(intent);
        return [memorySearchResult, ...regularResults];
      }
    }

    // If no memory match, perform regular search
    return await this.performRegularSearch(intent);
  }

  private async performRegularSearch(intent: BotIntent): Promise<SearchResult[]> {
    // Get all documents in the organized folders
    const allDocuments = await this.getAllOrganizedDocuments();
    
    // Filter based on intent parameters
    let filteredResults = allDocuments;

    // Apply filters based on parameters
    if (intent.parameters.document_type) {
      filteredResults = this.filterByDocumentType(filteredResults, intent.parameters.document_type);
    }

    if (intent.parameters.status) {
      filteredResults = this.filterByStatus(filteredResults, intent.parameters.status);
    }

    if (intent.parameters.signer) {
      filteredResults = this.filterBySigner(filteredResults, intent.parameters.signer);
    }

    if (intent.parameters.date_range) {
      filteredResults = this.filterByDateRange(filteredResults, intent.parameters.date_range);
    }

    if (intent.parameters.company) {
      filteredResults = this.filterByCompany(filteredResults, intent.parameters.company);
    }

    if (intent.parameters.category) {
      filteredResults = this.filterByCategory(filteredResults, intent.parameters.category);
    }

    if (intent.parameters.query) {
      filteredResults = this.filterByGeneralQuery(filteredResults, intent.parameters.query);
    }

    // Calculate relevance scores and sort
    const scoredResults = this.calculateRelevanceScores(filteredResults, intent);
    
    // Sort by relevance score (highest first)
    scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`📊 Search returned ${scoredResults.length} results`);
    return scoredResults;
  }

  async getDocumentByFilename(filename: string): Promise<SearchResult | null> {
    const allDocuments = await this.getAllOrganizedDocuments();
    const result = allDocuments.find(doc => 
      doc.filename.toLowerCase().includes(filename.toLowerCase()) ||
      path.basename(doc.filename, path.extname(doc.filename)).toLowerCase() === filename.toLowerCase()
    );

    if (result) {
      result.relevanceScore = 1.0; // Perfect match
      return result;
    }

    return null;
  }

  async getDocumentStatistics(): Promise<any> {
    const allDocuments = await this.getAllOrganizedDocuments();
    
    const stats = {
      totalDocuments: allDocuments.length,
      byStatus: {} as any,
      byCategory: {} as any,
      byFolder: {} as any,
      recentlyOrganized: [] as SearchResult[],
      mostCommonSigners: {} as any
    };

    // Calculate statistics
    for (const doc of allDocuments) {
      // Status statistics
      if (doc.metadata?.status) {
        stats.byStatus[doc.metadata.status] = (stats.byStatus[doc.metadata.status] || 0) + 1;
      }

      // Category statistics
      if (doc.metadata?.category) {
        stats.byCategory[doc.metadata.category] = (stats.byCategory[doc.metadata.category] || 0) + 1;
      }

      // Folder statistics
      const folderName = this.getFolderFromPath(doc.path);
      if (folderName) {
        stats.byFolder[folderName] = (stats.byFolder[folderName] || 0) + 1;
      }

      // Signer statistics
      if (doc.metadata?.signers) {
        for (const signer of doc.metadata.signers) {
          stats.mostCommonSigners[signer.name] = (stats.mostCommonSigners[signer.name] || 0) + 1;
        }
      }
    }

    // Get recently organized documents (last 10)
    const sortedByDate = allDocuments
      .filter(doc => doc.metadata?.fully_executed_date)
      .sort((a, b) => {
        const dateA = new Date(a.metadata!.fully_executed_date!);
        const dateB = new Date(b.metadata!.fully_executed_date!);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10);

    stats.recentlyOrganized = sortedByDate;

    return stats;
  }

  private async getAllOrganizedDocuments(): Promise<SearchResult[]> {
    const documents: SearchResult[] = [];

    if (!fs.existsSync(this.organizedFolderPath)) {
      return documents;
    }

    await this.scanDirectory(this.organizedFolderPath, documents);
    return documents;
  }

  private async scanDirectory(dirPath: string, documents: SearchResult[]): Promise<void> {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        await this.scanDirectory(fullPath, documents);
      } else if (stat.isFile() && !item.endsWith('.metadata.json')) {
        // This is a document file
        const metadata = await this.loadMetadata(fullPath);
        
        documents.push({
          filename: item,
          path: fullPath,
          metadata: metadata,
          relevanceScore: 0 // Will be calculated later
        });
      }
    }
  }

  private async loadMetadata(filePath: string): Promise<DocumentMetadata | undefined> {
    const metadataPath = `${filePath}.metadata.json`;
    
    if (fs.existsSync(metadataPath)) {
      try {
        const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
        return JSON.parse(metadataContent);
      } catch (error) {
        console.warn(`⚠️  Failed to load metadata for ${filePath}:`, error);
      }
    }
    
    return undefined;
  }

  private filterByDocumentType(results: SearchResult[], documentType: string): SearchResult[] {
    const type = documentType.toLowerCase();
    
    return results.filter(result => {
      const filename = result.filename.toLowerCase();
      const metadataType = result.metadata?.document_type?.toLowerCase() || '';
      
      // Check filename
      if (filename.includes(type)) return true;
      
      // Check metadata document type
      if (metadataType.includes(type)) return true;
      
      // Check for common variations
      if (type.includes('safe') && (filename.includes('safe') || metadataType.includes('safe'))) return true;
      if (type.includes('employment') && (filename.includes('employment') || filename.includes('offer'))) return true;
      if (type.includes('nda') && (filename.includes('nda') || filename.includes('confidentiality'))) return true;
      
      return false;
    });
  }

  private filterByStatus(results: SearchResult[], status: string): SearchResult[] {
    const targetStatus = status.toLowerCase();
    
    return results.filter(result => {
      if (!result.metadata?.status) return false;
      return result.metadata.status.toLowerCase() === targetStatus;
    });
  }

  private filterBySigner(results: SearchResult[], signer: string): SearchResult[] {
    const signerName = signer.toLowerCase();
    
    return results.filter(result => {
      if (!result.metadata?.signers) return false;
      
      return result.metadata.signers.some(s => 
        s.name.toLowerCase().includes(signerName)
      );
    });
  }

  private filterByDateRange(results: SearchResult[], dateRange: any): SearchResult[] {
    return results.filter(result => {
      if (!result.metadata?.fully_executed_date) return false;
      
      const docDate = new Date(result.metadata.fully_executed_date);
      
      if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        if (docDate < startDate) return false;
      }
      
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        if (docDate > endDate) return false;
      }
      
      return true;
    });
  }

  private filterByCompany(results: SearchResult[], company: string): SearchResult[] {
    const companyName = company.toLowerCase();
    
    return results.filter(result => {
      const filename = result.filename.toLowerCase();
      
      // Check filename
      if (filename.includes(companyName)) return true;
      
      // Check primary parties
      if (result.metadata?.primary_parties) {
        return result.metadata.primary_parties.some(party =>
          party.name.toLowerCase().includes(companyName) ||
          party.organization?.toLowerCase().includes(companyName)
        );
      }
      
      return false;
    });
  }

  private filterByCategory(results: SearchResult[], category: string): SearchResult[] {
    const categoryName = category.toLowerCase();
    
    return results.filter(result => {
      if (!result.metadata?.category) return false;
      return result.metadata.category.toLowerCase().includes(categoryName);
    });
  }

  private filterByGeneralQuery(results: SearchResult[], query: string): SearchResult[] {
    const searchTerm = query.toLowerCase();
    
    return results.filter(result => {
      const filename = result.filename.toLowerCase();
      const docType = result.metadata?.document_type?.toLowerCase() || '';
      const notes = result.metadata?.notes?.toLowerCase() || '';
      const tags = result.metadata?.tags?.join(' ').toLowerCase() || '';
      
      return filename.includes(searchTerm) ||
             docType.includes(searchTerm) ||
             notes.includes(searchTerm) ||
             tags.includes(searchTerm);
    });
  }

  private calculateRelevanceScores(results: SearchResult[], intent: BotIntent): SearchResult[] {
    return results.map(result => {
      let score = 0.5; // Base score
      
      // Boost score based on parameter matches
      if (intent.parameters.document_type) {
        const type = intent.parameters.document_type.toLowerCase();
        if (result.filename.toLowerCase().includes(type)) score += 0.3;
        if (result.metadata?.document_type?.toLowerCase().includes(type)) score += 0.2;
      }
      
      if (intent.parameters.status && result.metadata?.status === intent.parameters.status) {
        score += 0.2;
      }
      
      if (intent.parameters.signer && result.metadata?.signers) {
        const signerMatch = result.metadata.signers.some(s => 
          s.name.toLowerCase().includes(intent.parameters.signer!.toLowerCase())
        );
        if (signerMatch) score += 0.3;
      }
      
      // Boost recent documents
      if (result.metadata?.fully_executed_date) {
        const docDate = new Date(result.metadata.fully_executed_date);
        const daysSince = (Date.now() - docDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) score += 0.1; // Recent documents get a boost
      }
      
      result.relevanceScore = Math.min(score, 1.0); // Cap at 1.0
      return result;
    });
  }

  private getFolderFromPath(filePath: string): string | null {
    const relativePath = path.relative(this.organizedFolderPath, filePath);
    const parts = relativePath.split(path.sep);
    return parts.length > 0 ? parts[0] : null;
  }

  /**
   * Refresh all memory files
   */
  async refreshMemory(): Promise<void> {
    console.log('🧠 Refreshing memory files...');
    await this.memoryService.refreshAllMemory();
  }

  /**
   * Get quick answer from memory
   */
  async getQuickAnswer(query: string): Promise<{ answer: string; sources: string[] } | null> {
    return await this.memoryService.queryMemory(query);
  }
}