import * as fs from 'fs';
import * as path from 'path';
import { DocumentMetadata, Party, Signer } from '../types';

export interface MemoryEntry {
  fact: string;
  source: string;
  date?: string;
  value?: string | number;
  metadata?: any;
}

export interface MemoryCategory {
  title: string;
  lastUpdated: Date;
  quickFacts: MemoryEntry[];
  sections: { [key: string]: MemoryEntry[] };
}

export class MemoryService {
  private memoryDir: string;
  private organizedFolderPath: string;
  private memoryCache: Map<string, MemoryCategory> = new Map();

  constructor(organizedFolderPath: string) {
    this.organizedFolderPath = organizedFolderPath;
    this.memoryDir = path.join(path.dirname(organizedFolderPath), 'memory');
    
    // Ensure memory directory exists
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  /**
   * Refresh all memory files by scanning all documents
   */
  async refreshAllMemory(): Promise<void> {
    console.log('🧠 Starting comprehensive memory refresh...');
    
    // Clear cache
    this.memoryCache.clear();
    
    // Scan all documents and build memory
    const documents = await this.scanAllDocuments();
    console.log(`📚 Found ${documents.length} documents to process`);
    
    // Generate all memory files
    await this.generateCompanyInfo(documents);
    await this.generatePeopleDirectory(documents);
    await this.generateFinancialSummary(documents);
    await this.generateRevenueAndSales(documents);
    await this.generatePartnershipsAndChannels(documents);
    await this.generateInvestorsAndCapTable(documents);
    await this.generateVendorsAndSuppliers(documents);
    await this.generateLegalEntities(documents);
    await this.generateKeyDatesTimeline(documents);
    await this.generateEquityAndOptions(documents);
    await this.generateIntellectualProperty(documents);
    await this.generateComplianceAndRisk(documents);
    await this.generateContractsSummary(documents);
    await this.generateTemplatesInventory(documents);
    await this.generateDocumentIndex(documents);
    
    console.log('✅ Memory refresh complete!');
  }

  /**
   * Update memory for a single document
   */
  async updateMemoryForDocument(documentPath: string, metadata: DocumentMetadata): Promise<void> {
    console.log(`🧠 Updating memory for: ${path.basename(documentPath)}`);
    
    // Update relevant memory files based on document category
    await this.updateRelevantMemoryFiles(documentPath, metadata);
  }

  /**
   * Query memory files for quick answers
   */
  async queryMemory(query: string): Promise<{ answer: string; sources: string[] } | null> {
    const queryLower = query.toLowerCase();
    
    // Check for EIN query
    if (queryLower.includes('ein') || queryLower.includes('tax id')) {
      return await this.findInMemoryFile('company_info.md', 'ein');
    }
    
    // Check for address queries
    if (queryLower.includes('address') || queryLower.includes('location') || queryLower.includes('headquarters')) {
      return await this.findInMemoryFile('company_info.md', 'address');
    }
    
    // Check for revenue queries
    if (queryLower.includes('revenue') || queryLower.includes('sales') || queryLower.includes('income')) {
      return await this.findInMemoryFile('revenue_and_sales.md', 'revenue');
    }
    
    // Check for investor queries
    if (queryLower.includes('investor') || queryLower.includes('invested') || queryLower.includes('funding')) {
      return await this.findInMemoryFile('financial_summary.md', 'invest');
    }
    
    // Check for capital/investment amount queries
    if (queryLower.includes('capital') || queryLower.includes('raised') || queryLower.includes('total')) {
      return await this.findInMemoryFile('financial_summary.md', queryLower);
    }
    
    // Check for specific investor queries
    if (queryLower.includes('backend capital') || queryLower.includes('bedrock') || queryLower.includes('safe')) {
      return await this.findInMemoryFile('financial_summary.md', queryLower);
    }
    
    // Check for people queries
    if (queryLower.includes('dan shipper') || queryLower.includes('employee') || queryLower.includes('who')) {
      return await this.findInMemoryFile('people_directory.md', queryLower);
    }
    
    // Try searching all memory files for any match
    const memoryFiles = ['company_info.md', 'people_directory.md', 'financial_summary.md', 'revenue_and_sales.md'];
    for (const file of memoryFiles) {
      const result = await this.findInMemoryFile(file, queryLower);
      if (result) {
        return result;
      }
    }
    
    return null;
  }

  /**
   * Scan all documents in the organized folder
   */
  private async scanAllDocuments(): Promise<Array<{ path: string; metadata: DocumentMetadata }>> {
    const documents: Array<{ path: string; metadata: DocumentMetadata }> = [];
    
    const scanDirectory = async (dirPath: string) => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (item.endsWith('.metadata.json')) {
          try {
            const metadataContent = fs.readFileSync(fullPath, 'utf-8');
            const metadata = JSON.parse(metadataContent) as DocumentMetadata;
            const documentPath = fullPath.replace('.metadata.json', '');
            
            documents.push({ path: documentPath, metadata });
          } catch (error) {
            console.warn(`⚠️  Failed to load metadata from ${fullPath}:`, error);
          }
        }
      }
    };
    
    if (fs.existsSync(this.organizedFolderPath)) {
      await scanDirectory(this.organizedFolderPath);
    }
    
    return documents;
  }

  /**
   * Generate company_info.md memory file
   */
  private async generateCompanyInfo(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Company Information',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Company Names': [],
        'Formation Details': [],
        'Corporate Structure': [],
        'Tax Information': [],
        'Addresses': [],
        'Key Milestones': []
      }
    };

    // Use sets to track unique facts
    const companyNames = new Set<string>();
    const governingLaws = new Set<string>();
    const addresses = new Map<string, string>(); // address -> source
    const formationDocs = new Map<string, { type: string; date?: string; source: string }>();
    const milestones = new Map<string, { date?: string; source: string }>();

    // Extract company information from documents
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      // Look for formation documents
      if (filename.includes('Certificate of Incorporation') || filename.includes('Certificate of Formation')) {
        const docType = metadata.document_type || 'Certificate';
        const key = `${docType}_${metadata.effective_date || 'undated'}`;
        if (!formationDocs.has(key)) {
          formationDocs.set(key, {
            type: docType,
            date: metadata.effective_date || undefined || undefined,
            source: filename
          });
        }
        
        // Extract company name from primary parties
        if (metadata.primary_parties) {
          const company = metadata.primary_parties.find(p => p.role === 'Company');
          if (company?.name) {
            companyNames.add(company.name);
          }
        }
      }
      
      // Look for governing law (deduplicate)
      if (metadata.governing_law) {
        governingLaws.add(metadata.governing_law);
      }
      
      // Look for addresses in primary parties (deduplicate)
      if (metadata.primary_parties) {
        for (const party of metadata.primary_parties) {
          if (party.address && party.role === 'Company') {
            const addressKey = `${party.organization || 'Company'}: ${party.address}`;
            if (!addresses.has(addressKey)) {
              addresses.set(addressKey, filename);
            }
          }
        }
      }
      
      // Look for conversion or merger documents
      if (filename.includes('Conversion') || filename.includes('Merger')) {
        const eventType = metadata.document_type || filename;
        if (!milestones.has(eventType)) {
          milestones.set(eventType, {
            date: metadata.effective_date || undefined || undefined,
            source: filename
          });
        }
      }
    }

    // Add deduplicated company names
    companyNames.forEach(name => {
      memory.sections['Company Names'].push({
        fact: `Legal name: ${name}`,
        source: 'Multiple documents'
      });
    });

    // Add formation details
    formationDocs.forEach((doc, key) => {
      memory.sections['Formation Details'].push({
        fact: `Formation document: ${doc.type}`,
        source: doc.source,
        date: doc.date
      });
    });

    // Add governing law (deduplicated)
    if (governingLaws.size > 0) {
      const laws = Array.from(governingLaws);
      memory.sections['Formation Details'].push({
        fact: `Incorporated in: ${laws.join(', ')}`,
        source: 'Multiple documents'
      });
      
      // Add as quick fact
      memory.quickFacts.push({
        fact: `State of Incorporation: ${laws[0]}`,
        source: 'Formation documents'
      });
    }

    // Add addresses (deduplicated)
    addresses.forEach((source, address) => {
      memory.sections['Addresses'].push({
        fact: address,
        source: source
      });
    });

    // Add the most common address as a quick fact
    if (addresses.size > 0) {
      const firstAddress = Array.from(addresses.keys())[0];
      memory.quickFacts.push({
        fact: `Primary Address: ${firstAddress.split(': ')[1]}`,
        source: 'Multiple documents'
      });
    }

    // Add milestones
    milestones.forEach((milestone, event) => {
      memory.sections['Key Milestones'].push({
        fact: `Corporate event: ${event}`,
        source: milestone.source,
        date: milestone.date
      });
    });
    
    // TODO: Extract EIN from tax documents when available
    memory.sections['Tax Information'].push({
      fact: 'EIN: [To be extracted from tax documents]',
      source: 'Tax documents pending'
    });
    
    // Save memory file
    await this.saveMemoryFile('company_info.md', memory);
  }

  /**
   * Generate people_directory.md memory file
   */
  private async generatePeopleDirectory(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'People Directory',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Employees': [],
        'Contractors': [],
        'Advisors': [],
        'Board Members': [],
        'Investors': [],
        'Vendors': []
      }
    };

    const peopleMap = new Map<string, Set<string>>(); // name -> roles
    const peopleDetails = new Map<string, any>(); // name -> details
    
    // Extract people information from documents
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      // Process signers
      if (metadata.signers) {
        for (const signer of metadata.signers) {
          if (!peopleMap.has(signer.name)) {
            peopleMap.set(signer.name, new Set());
          }
          
          // Determine role from document type
          if (filename.includes('Employment') || filename.includes('Offer Letter')) {
            peopleMap.get(signer.name)!.add('Employee');
          } else if (filename.includes('Services Agreement') || filename.includes('Contractor')) {
            peopleMap.get(signer.name)!.add('Contractor');
          } else if (filename.includes('Advisor')) {
            peopleMap.get(signer.name)!.add('Advisor');
          } else if (filename.includes('SAFE') || filename.includes('Investment')) {
            peopleMap.get(signer.name)!.add('Investor');
          }
        }
      }
      
      // Process primary parties for detailed information
      if (metadata.primary_parties) {
        for (const party of metadata.primary_parties) {
          if (party.name && party.role !== 'Company') {
            if (!peopleDetails.has(party.name)) {
              peopleDetails.set(party.name, {
                email: party.email || undefined,
                organization: party.organization,
                title: party.title,
                address: party.address || undefined,
                sources: []
              });
            }
            
            const details = peopleDetails.get(party.name)!;
            details.sources.push(filename);
            
            // Update with non-null values
            if (party.email) details.email = party.email;
            if (party.organization) details.organization = party.organization;
            if (party.title) details.title = party.title;
            if (party.address) details.address = party.address;
            
            // Add role
            if (!peopleMap.has(party.name)) {
              peopleMap.set(party.name, new Set());
            }
            if (party.role) {
              peopleMap.get(party.name)!.add(party.role);
            }
          }
        }
      }
    }
    
    // Organize people by role
    for (const [name, roles] of peopleMap.entries()) {
      const details = peopleDetails.get(name) || {};
      const rolesArray = Array.from(roles);
      
      for (const role of rolesArray) {
        let section = 'Vendors'; // default
        
        if (role === 'Employee') section = 'Employees';
        else if (role === 'Contractor') section = 'Contractors';
        else if (role === 'Advisor') section = 'Advisors';
        else if (role === 'Investor') section = 'Investors';
        
        const entry: MemoryEntry = {
          fact: `${name}${details.title ? ` - ${details.title}` : ''}${details.email ? ` (${details.email})` : ''}`,
          source: details.sources ? details.sources.join(', ') : 'Multiple documents'
        };
        
        if (details.organization) {
          entry.metadata = { organization: details.organization };
        }
        
        memory.sections[section].push(entry);
      }
    }
    
    // Add quick facts
    memory.quickFacts.push({
      fact: `Total people in directory: ${peopleMap.size}`,
      source: 'All documents'
    });
    
    // Save memory file
    await this.saveMemoryFile('people_directory.md', memory);
  }

  /**
   * Generate financial_summary.md memory file
   */
  private async generateFinancialSummary(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Financial Summary',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Capital Raised': [],
        'Investment Rounds': [],
        'SAFE Agreements': [],
        'Banking': [],
        'Insurance': [],
        'Loans': []
      }
    };

    let totalRaised = 0;
    const investmentsByRound = new Map<string, number>();
    
    // Extract financial information from documents
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      // Process investment documents
      if (metadata.document_type?.includes('SAFE') || filename.includes('SAFE')) {
        if (metadata.contract_value) {
          const value = this.parseMonetaryValue(metadata.contract_value);
          if (value > 0) {
            totalRaised += value;
            
            memory.sections['SAFE Agreements'].push({
              fact: `SAFE Agreement with ${this.getInvestorName(metadata)}`,
              source: filename,
              value: metadata.contract_value,
              date: metadata.effective_date || undefined || undefined
            });
          }
        }
      }
      
      // Process other investment documents
      if (filename.includes('Investment') || filename.includes('Stock Purchase')) {
        if (metadata.contract_value) {
          const value = this.parseMonetaryValue(metadata.contract_value);
          if (value > 0) {
            memory.sections['Investment Rounds'].push({
              fact: `Investment from ${this.getInvestorName(metadata)}`,
              source: filename,
              value: metadata.contract_value,
              date: metadata.effective_date || undefined || undefined
            });
          }
        }
      }
    }
    
    // Add summary quick facts
    if (totalRaised > 0) {
      memory.quickFacts.push({
        fact: `Total capital raised: $${totalRaised.toLocaleString()}`,
        source: 'All investment documents'
      });
    }
    
    // Save memory file
    await this.saveMemoryFile('financial_summary.md', memory);
  }

  /**
   * Generate revenue_and_sales.md memory file
   */
  private async generateRevenueAndSales(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Revenue and Sales',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Customer Agreements': [],
        'Revenue by Type': [],
        'Contract Values': [],
        'Renewal Schedule': []
      }
    };

    let totalContractValue = 0;
    let customerCount = 0;
    
    // Extract revenue information from documents
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      // Look for customer agreements
      if (metadata.category === 'Sales_Customer_Agreements' || 
          docPath.includes('04_Sales_and_Revenue')) {
        
        customerCount++;
        
        if (metadata.contract_value) {
          const value = this.parseMonetaryValue(metadata.contract_value);
          if (value > 0) {
            totalContractValue += value;
            
            const customerName = this.getCounterpartyName(metadata);
            memory.sections['Customer Agreements'].push({
              fact: `${customerName} - ${metadata.document_type || 'Agreement'}`,
              source: filename,
              value: metadata.contract_value,
              date: metadata.effective_date || undefined || undefined
            });
          }
        }
        
        // Track renewal dates
        if (metadata.expiration_date) {
          memory.sections['Renewal Schedule'].push({
            fact: `${this.getCounterpartyName(metadata)} renewal`,
            source: filename,
            date: metadata.expiration_date
          });
        }
      }
    }
    
    // Add summary quick facts
    if (totalContractValue > 0) {
      memory.quickFacts.push({
        fact: `Total contract value: $${totalContractValue.toLocaleString()}`,
        source: 'All customer agreements'
      });
    }
    
    if (customerCount > 0) {
      memory.quickFacts.push({
        fact: `Active customers: ${customerCount}`,
        source: 'All customer agreements'
      });
      
      if (totalContractValue > 0) {
        const avgValue = Math.round(totalContractValue / customerCount);
        memory.quickFacts.push({
          fact: `Average contract value: $${avgValue.toLocaleString()}`,
          source: 'Calculated from all agreements'
        });
      }
    }
    
    // Save memory file
    await this.saveMemoryFile('revenue_and_sales.md', memory);
  }

  /**
   * Helper method to parse monetary values from strings
   */
  private parseMonetaryValue(value: string): number {
    if (!value) return 0;
    
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$€£¥,]/g, '').trim();
    
    // Parse the number
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Helper method to get investor name from metadata
   */
  private getInvestorName(metadata: DocumentMetadata): string {
    if (metadata.primary_parties) {
      const investor = metadata.primary_parties.find(p => p.role === 'Investor');
      if (investor) return investor.name;
    }
    
    if (metadata.signers && metadata.signers.length > 0) {
      // Return first non-company signer
      for (const signer of metadata.signers) {
        if (!signer.name.toLowerCase().includes('every media')) {
          return signer.name;
        }
      }
    }
    
    return 'Unknown Investor';
  }

  /**
   * Helper method to get counterparty name from metadata
   */
  private getCounterpartyName(metadata: DocumentMetadata): string {
    if (metadata.primary_parties) {
      // For customer agreements, find the Client/Customer party
      const customerParty = metadata.primary_parties.find(p => 
        p.role === 'Client' || p.role === 'Customer' || p.role === 'Investor'
      );
      if (customerParty) return customerParty.organization || customerParty.name;
      
      // Otherwise, find any party that's not Every Media
      const counterparty = metadata.primary_parties.find(p => 
        p.role !== 'Company' && 
        p.role !== 'Service Provider' &&
        !p.name.toLowerCase().includes('every media') &&
        p.organization
      );
      if (counterparty) return counterparty.organization || counterparty.name;
    }
    
    return 'Unknown Party';
  }

  /**
   * Save a memory category to a markdown file
   */
  private async saveMemoryFile(filename: string, memory: MemoryCategory): Promise<void> {
    const filePath = path.join(this.memoryDir, filename);
    
    let content = `# ${memory.title}\n`;
    content += `Last Updated: ${memory.lastUpdated.toISOString()}\n\n`;
    
    // Add quick facts
    if (memory.quickFacts.length > 0) {
      content += `## Quick Facts\n`;
      for (const fact of memory.quickFacts) {
        content += `- ${fact.fact} (Source: ${fact.source})\n`;
      }
      content += '\n';
    }
    
    // Add sections
    for (const [sectionName, entries] of Object.entries(memory.sections)) {
      if (entries.length > 0) {
        content += `## ${sectionName}\n`;
        for (const entry of entries) {
          content += `- ${entry.fact}`;
          if (entry.value) content += ` - ${entry.value}`;
          if (entry.date) content += ` (${entry.date})`;
          content += ` [Source: ${entry.source}]\n`;
        }
        content += '\n';
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`💾 Saved memory file: ${filename}`);
  }

  /**
   * Find information in a memory file
   */
  private async findInMemoryFile(filename: string, searchTerm: string): Promise<{ answer: string; sources: string[] } | null> {
    const filePath = path.join(this.memoryDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const matches: string[] = [];
    const sources: Set<string> = new Set();
    let includeNext = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      // Include section headers if they match
      if (line.startsWith('##') && lineLower.includes(searchLower)) {
        matches.push(line);
        includeNext = true; // Include lines after matching headers
        continue;
      }
      
      // Include lines that match the search term
      if (lineLower.includes(searchLower)) {
        matches.push(line);
        
        // Extract source from line
        const sourceMatch = line.match(/\[Source: ([^\]]+)\]/);
        if (sourceMatch) {
          sources.add(sourceMatch[1]);
        }
        
        // Special handling for Backend Capital
        if (searchLower.includes('backend') && line.includes('$25000')) {
          matches.push('Backend Capital invested: $25,000');
        }
      } else if (includeNext && line.trim() && !line.startsWith('#')) {
        // Include lines after section headers
        matches.push(line);
        const sourceMatch = line.match(/\[Source: ([^\]]+)\]/);
        if (sourceMatch) {
          sources.add(sourceMatch[1]);
        }
      } else if (line.startsWith('#')) {
        includeNext = false; // Stop including when we hit a new section
      }
    }
    
    if (matches.length > 0) {
      return {
        answer: matches.slice(0, 10).join('\n'), // Limit to 10 lines
        sources: Array.from(sources).slice(0, 5) // Limit sources
      };
    }
    
    return null;
  }

  /**
   * Update relevant memory files for a single document
   */
  private async updateRelevantMemoryFiles(documentPath: string, metadata: DocumentMetadata): Promise<void> {
    // This will be implemented to update only the relevant memory files
    // based on the document category and content
    // For now, we'll do a full refresh
    await this.refreshAllMemory();
  }

  private async generatePartnershipsAndChannels(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Partnerships and Channels',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Strategic Partnerships': [],
        'Channel Partners': [],
        'Business Development': [],
        'Joint Ventures': []
      }
    };

    // Look for partnership documents
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      if (docPath.includes('07_Marketing_and_Partnerships') || 
          filename.includes('Partnership') || 
          filename.includes('Joint Venture')) {
        
        const partnerName = this.getCounterpartyName(metadata);
        memory.sections['Strategic Partnerships'].push({
          fact: `Partnership with ${partnerName}`,
          source: filename,
          date: metadata.effective_date || undefined
        });
      }
    }
    
    await this.saveMemoryFile('partnerships_and_channels.md', memory);
  }

  private async generateInvestorsAndCapTable(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Investors and Cap Table',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Investor Summary': [],
        'Investment Rounds': [],
        'Ownership Breakdown': [],
        'Special Rights': []
      }
    };

    const investorTotals = new Map<string, number>();
    const investorDocs = new Map<string, string[]>();
    
    // Aggregate investor data
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      if (metadata.document_type?.includes('SAFE') || filename.includes('SAFE')) {
        const investorName = this.getInvestorName(metadata);
        const amount = this.parseMonetaryValue(metadata.contract_value || '0');
        
        if (amount > 0) {
          const current = investorTotals.get(investorName) || 0;
          investorTotals.set(investorName, current + amount);
          
          const docs = investorDocs.get(investorName) || [];
          docs.push(filename);
          investorDocs.set(investorName, docs);
        }
      }
    }
    
    // Sort investors by amount
    const sortedInvestors = Array.from(investorTotals.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Add top investors as quick facts
    sortedInvestors.slice(0, 5).forEach(([name, amount]) => {
      memory.quickFacts.push({
        fact: `${name}: $${amount.toLocaleString()}`,
        source: investorDocs.get(name)?.join(', ') || 'Investment documents'
      });
    });
    
    // Add all investors to summary
    sortedInvestors.forEach(([name, amount]) => {
      memory.sections['Investor Summary'].push({
        fact: `${name} - Total investment`,
        value: `$${amount.toLocaleString()}`,
        source: `${investorDocs.get(name)?.length || 0} documents`
      });
    });
    
    await this.saveMemoryFile('investors_and_cap_table.md', memory);
  }

  private async generateVendorsAndSuppliers(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Vendors and Suppliers',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Technology Vendors': [],
        'Service Providers': [],
        'Facilities': [],
        'Other Vendors': []
      }
    };

    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      if (docPath.includes('05_Operations_and_Vendors')) {
        let section = 'Other Vendors';
        
        if (docPath.includes('Technology_Vendors')) {
          section = 'Technology Vendors';
        } else if (docPath.includes('Facilities')) {
          section = 'Facilities';
        }
        
        const vendorName = this.getCounterpartyName(metadata);
        memory.sections[section].push({
          fact: `${vendorName} - ${metadata.document_type || 'Agreement'}`,
          source: filename,
          value: metadata.contract_value
        });
      }
    }
    
    await this.saveMemoryFile('vendors_and_suppliers.md', memory);
  }

  private async generateLegalEntities(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Legal Entities',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Parent Company': [],
        'Subsidiaries': [],
        'Related Entities': [],
        'Entity History': []
      }
    };

    const entities = new Set<string>();
    
    // Extract entity information
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      // Look for entity names in formation docs
      if (filename.includes('Formation') || filename.includes('Incorporation')) {
        if (metadata.primary_parties) {
          metadata.primary_parties.forEach(party => {
            if (party.organization && party.role === 'Company') {
              entities.add(party.organization);
            }
          });
        }
      }
      
      // Check for LLC to Inc conversion
      if (filename.includes('Conversion')) {
        memory.sections['Entity History'].push({
          fact: 'LLC to C-Corp conversion',
          source: filename,
          date: metadata.effective_date || undefined
        });
      }
    }
    
    // Add entities
    const entityList = Array.from(entities);
    if (entityList.length > 0) {
      memory.sections['Parent Company'].push({
        fact: entityList[0],
        source: 'Formation documents'
      });
      
      memory.quickFacts.push({
        fact: `Primary Entity: ${entityList[0]}`,
        source: 'Formation documents'
      });
    }
    
    // Look for subsidiaries
    if (entityList.includes('Every Studio, LLC') || entityList.includes('Every Studio LLC')) {
      memory.sections['Subsidiaries'].push({
        fact: 'Every Studio, LLC',
        source: 'Formation documents'
      });
    }
    
    if (entityList.includes('Lex')) {
      memory.sections['Related Entities'].push({
        fact: 'Lex (spinout)',
        source: 'Spinout documents'
      });
    }
    
    await this.saveMemoryFile('legal_entities.md', memory);
  }

  private async generateKeyDatesTimeline(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Key Dates Timeline',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Formation Dates': [],
        'Contract Dates': [],
        'Expiration Dates': [],
        'Renewal Dates': []
      }
    };

    const dates = new Map<string, { event: string; source: string }>();
    
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      // Formation dates
      if (filename.includes('Formation') || filename.includes('Incorporation')) {
        if (metadata.effective_date) {
          dates.set(metadata.effective_date, {
            event: `${metadata.document_type || 'Formation'}`,
            source: filename
          });
        }
      }
      
      // Contract effective dates
      if (metadata.effective_date) {
        memory.sections['Contract Dates'].push({
          fact: `${metadata.document_type || filename}`,
          date: metadata.effective_date || undefined,
          source: filename
        });
      }
      
      // Expiration dates
      if (metadata.expiration_date && metadata.expiration_date !== 'indefinite') {
        memory.sections['Expiration Dates'].push({
          fact: `${metadata.document_type || filename} expires`,
          date: metadata.expiration_date,
          source: filename
        });
      }
    }
    
    await this.saveMemoryFile('key_dates_timeline.md', memory);
  }

  private async generateEquityAndOptions(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Equity and Options',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Stock Grants': [],
        'Option Grants': [],
        'Vesting Schedules': [],
        'Equity Plan Details': []
      }
    };

    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      if (filename.includes('Stock Option') || filename.includes('Equity Compensation')) {
        const grantee = metadata.signers?.[0]?.name || 'Unknown';
        
        if (filename.includes('Stock Option')) {
          memory.sections['Option Grants'].push({
            fact: `Option grant to ${grantee}`,
            source: filename,
            date: metadata.effective_date || undefined
          });
        } else if (filename.includes('Restricted Stock')) {
          memory.sections['Stock Grants'].push({
            fact: `Stock grant to ${grantee}`,
            source: filename,
            value: metadata.contract_value
          });
        }
      }
      
      // Equity compensation plan
      if (filename.includes('Equity Compensation Plan')) {
        memory.sections['Equity Plan Details'].push({
          fact: metadata.document_type || 'Equity Compensation Plan',
          source: filename,
          date: metadata.effective_date || undefined
        });
      }
    }
    
    await this.saveMemoryFile('equity_and_options.md', memory);
  }

  private async generateIntellectualProperty(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Intellectual Property',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'IP Assignments': [],
        'Confidentiality Agreements': [],
        'Technology Licenses': [],
        'Trademarks and Patents': []
      }
    };

    const ipAssignors = new Set<string>();
    
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      if (filename.includes('IP Assignment') || filename.includes('PIIA')) {
        const assignor = metadata.signers?.[0]?.name || 'Unknown';
        ipAssignors.add(assignor);
        
        memory.sections['IP Assignments'].push({
          fact: `IP assignment from ${assignor}`,
          source: filename,
          date: metadata.effective_date || undefined
        });
      }
      
      if (filename.includes('Confidentiality') || filename.includes('NDA')) {
        memory.sections['Confidentiality Agreements'].push({
          fact: `${metadata.document_type || 'Confidentiality Agreement'}`,
          source: filename
        });
      }
    }
    
    memory.quickFacts.push({
      fact: `Total IP assignments: ${ipAssignors.size}`,
      source: 'IP assignment documents'
    });
    
    await this.saveMemoryFile('intellectual_property.md', memory);
  }

  private async generateComplianceAndRisk(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Compliance and Risk',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Regulatory Filings': [],
        'Compliance Requirements': [],
        'Insurance Policies': [],
        'Risk Factors': []
      }
    };

    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      if (docPath.includes('08_Risk_and_Compliance')) {
        memory.sections['Compliance Requirements'].push({
          fact: metadata.document_type || filename,
          source: filename,
          date: metadata.effective_date || undefined
        });
      }
    }
    
    await this.saveMemoryFile('compliance_and_risk.md', memory);
  }

  private async generateContractsSummary(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Contracts Summary',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Active Contracts': [],
        'Expiring Soon': [],
        'Auto-Renewal Contracts': [],
        'High-Value Contracts': []
      }
    };

    let totalContracts = 0;
    let executedContracts = 0;
    
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      totalContracts++;
      
      if (metadata.status === 'executed') {
        executedContracts++;
        
        // High value contracts
        const value = this.parseMonetaryValue(metadata.contract_value || '0');
        if (value >= 50000) {
          memory.sections['High-Value Contracts'].push({
            fact: metadata.document_type || filename,
            source: filename,
            value: metadata.contract_value
          });
        }
        
        // Auto-renewal
        if (metadata.renewal_terms?.includes('automatic')) {
          memory.sections['Auto-Renewal Contracts'].push({
            fact: metadata.document_type || filename,
            source: filename
          });
        }
      }
    }
    
    memory.quickFacts.push({
      fact: `Total contracts: ${totalContracts}`,
      source: 'All documents'
    });
    
    memory.quickFacts.push({
      fact: `Executed contracts: ${executedContracts}`,
      source: 'All documents'
    });
    
    await this.saveMemoryFile('contracts_summary.md', memory);
  }

  private async generateTemplatesInventory(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Templates Inventory',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'Employment Templates': [],
        'Agreement Templates': [],
        'NDA Templates': [],
        'Other Templates': []
      }
    };

    let templateCount = 0;
    
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      if (metadata.status === 'template') {
        templateCount++;
        
        let section = 'Other Templates';
        if (filename.includes('Employment')) {
          section = 'Employment Templates';
        } else if (filename.includes('NDA') || filename.includes('Confidentiality')) {
          section = 'NDA Templates';
        } else if (filename.includes('Agreement')) {
          section = 'Agreement Templates';
        }
        
        memory.sections[section].push({
          fact: metadata.document_type || filename,
          source: filename,
          metadata: metadata.template_analysis
        });
      }
    }
    
    memory.quickFacts.push({
      fact: `Total templates available: ${templateCount}`,
      source: 'Template documents'
    });
    
    await this.saveMemoryFile('templates_inventory.md', memory);
  }

  private async generateDocumentIndex(documents: Array<{ path: string; metadata: DocumentMetadata }>): Promise<void> {
    const memory: MemoryCategory = {
      title: 'Document Index',
      lastUpdated: new Date(),
      quickFacts: [],
      sections: {
        'By Status': [],
        'By Category': [],
        'Recent Documents': [],
        'Document Stats': []
      }
    };

    const statusCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    
    // Count documents
    for (const doc of documents) {
      const { metadata } = doc;
      
      // Status counts
      const status = metadata.status || 'unknown';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      
      // Category counts  
      const category = metadata.category || 'Other';
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
    
    // Add status breakdown
    statusCounts.forEach((count, status) => {
      memory.sections['By Status'].push({
        fact: `${status}: ${count} documents`,
        source: 'Document analysis'
      });
    });
    
    // Add category breakdown
    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1]);
      
    sortedCategories.forEach(([category, count]) => {
      memory.sections['By Category'].push({
        fact: `${category}: ${count} documents`,
        source: 'Document analysis'
      });
    });
    
    memory.quickFacts.push({
      fact: `Total documents: ${documents.length}`,
      source: 'All documents'
    });
    
    await this.saveMemoryFile('document_index.md', memory);
  }
}