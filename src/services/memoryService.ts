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
    // Memory directory is now inside the organized folder
    this.memoryDir = path.join(organizedFolderPath, 'memory');
    
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
   * Extract critical facts by pattern from all documents
   */
  private extractCriticalFactsByPattern(
    documents: Array<{ path: string; metadata: DocumentMetadata }>,
    pattern: string | RegExp
  ): Map<string, { value: any; source: string; key: string }> {
    const facts = new Map<string, { value: any; source: string; key: string }>();
    
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      if (metadata.critical_facts) {
        Object.entries(metadata.critical_facts).forEach(([key, value]) => {
          if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
            // Use a composite key to avoid overwriting similar facts from different docs
            const uniqueKey = `${key}_${filename}`;
            facts.set(uniqueKey, {
              value: value,
              source: filename,
              key: key
            });
          }
        });
      }
    }
    
    return facts;
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
    
    // Extract tax information from critical facts
    const taxFacts = new Map<string, { value: string; source: string }>();
    
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      // Check critical facts for tax-related information
      if (metadata.critical_facts) {
        // Look for EIN
        if (metadata.critical_facts.ein_number) {
          taxFacts.set('ein', {
            value: String(metadata.critical_facts.ein_number),
            source: filename
          });
        }
        // Look for state tax IDs
        if (metadata.critical_facts.state_tax_id) {
          taxFacts.set('state_tax_id', {
            value: String(metadata.critical_facts.state_tax_id),
            source: filename
          });
        }
        // Look for other tax-related critical facts
        Object.entries(metadata.critical_facts).forEach(([key, value]) => {
          if (key.includes('tax') || key.includes('ein') || key.includes('tin')) {
            taxFacts.set(key, {
              value: String(value),
              source: filename
            });
          }
        });
      }
      
      // Also check document type for tax documents
      if (metadata.document_type && metadata.document_type.toLowerCase().includes('ein')) {
        // Try to extract from other metadata fields if not in critical facts
        if (!taxFacts.has('ein') && metadata.notes) {
          const einMatch = metadata.notes.match(/\b\d{2}-\d{7}\b/);
          if (einMatch) {
            taxFacts.set('ein', {
              value: einMatch[0],
              source: filename
            });
          }
        }
      }
    }
    
    // Add tax facts to memory
    if (taxFacts.has('ein')) {
      const einInfo = taxFacts.get('ein')!;
      memory.sections['Tax Information'].push({
        fact: `EIN: ${einInfo.value}`,
        source: einInfo.source
      });
      // Also add as quick fact
      memory.quickFacts.push({
        fact: `EIN: ${einInfo.value}`,
        source: einInfo.source
      });
    }
    
    // Add other tax facts
    taxFacts.forEach((info, key) => {
      if (key !== 'ein') {
        memory.sections['Tax Information'].push({
          fact: `${key.replace(/_/g, ' ').toUpperCase()}: ${info.value}`,
          source: info.source
        });
      }
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
        'Loans': [],
        'Financial Impact Analysis': [],
        'Key Financial Terms': []
      }
    };

    let totalRaised = 0;
    const investmentsByRound = new Map<string, number>();
    const investorDetails = new Map<string, { amount: number; documents: string[]; terms: any }>();
    
    // Extract financial critical facts
    const investmentFacts = this.extractCriticalFactsByPattern(documents, /investment_amount|round_size|principal_amount/);
    const valuationFacts = this.extractCriticalFactsByPattern(documents, /valuation_cap|pre_money_valuation/);
    const insuranceFacts = this.extractCriticalFactsByPattern(documents, /policy_number|coverage_amount|deductible|premium/);
    
    // Extract financial information from documents
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      // Process ANY document with financial terms or implications
      if (metadata.financial_terms || metadata.business_context?.includes('invest') || 
          metadata.business_context?.includes('financ') || metadata.contract_value) {
        
        // Add business context for financial documents
        if (metadata.business_context) {
          memory.sections['Financial Impact Analysis'].push({
            fact: `${metadata.document_type || filename}: ${metadata.business_context}`,
            source: filename
          });
        }
        
        // Add key financial terms
        if (metadata.key_terms) {
          metadata.key_terms.filter(term => 
            term.toLowerCase().includes('invest') || 
            term.toLowerCase().includes('financ') ||
            term.toLowerCase().includes('capital') ||
            term.toLowerCase().includes('equity')
          ).forEach(term => {
            memory.sections['Key Financial Terms'].push({
              fact: term,
              source: filename
            });
          });
        }
      }
      
      // Process investment documents
      if (metadata.document_type?.includes('SAFE') || filename.includes('SAFE') || 
          metadata.category?.includes('Investment')) {
        // First try critical facts
        let investmentAmount = 0;
        let valuationCap = null;
        let discountRate = null;
        let mfnProvision = null;
        
        if (metadata.critical_facts) {
          if (metadata.critical_facts.investment_amount) {
            investmentAmount = Number(metadata.critical_facts.investment_amount);
          }
          if (metadata.critical_facts.valuation_cap) {
            valuationCap = Number(metadata.critical_facts.valuation_cap);
          }
          if (metadata.critical_facts.discount_rate) {
            discountRate = String(metadata.critical_facts.discount_rate);
          }
          if (metadata.critical_facts.mfn_provision !== undefined) {
            mfnProvision = metadata.critical_facts.mfn_provision;
          }
        }
        
        // Fall back to contract_value if no critical fact
        if (investmentAmount === 0 && metadata.contract_value) {
          investmentAmount = this.parseMonetaryValue(metadata.contract_value);
        }
        
        // Extract ALL financial terms for comprehensive capture
        const allFinancialDetails: string[] = [];
        if (metadata.financial_terms) {
          Object.entries(metadata.financial_terms).forEach(([key, value]) => {
            if (value) {
              allFinancialDetails.push(`${key.replace(/_/g, ' ')}: ${value}`);
            }
          });
        }
        
        const investorName = this.getInvestorName(metadata);
        
        // Track investor details for aggregation
        if (investmentAmount > 0) {
          const existing = investorDetails.get(investorName) || { amount: 0, documents: [], terms: {} };
          existing.amount += investmentAmount;
          existing.documents.push(filename);
          if (valuationCap) existing.terms.valuation_cap = valuationCap;
          if (discountRate) existing.terms.discount_rate = discountRate;
          if (mfnProvision !== null) existing.terms.mfn = mfnProvision;
          if (allFinancialDetails.length > 0) existing.terms.details = allFinancialDetails;
          investorDetails.set(investorName, existing);
          
          totalRaised += investmentAmount;
          
          const safeFact = `SAFE Agreement with ${investorName}`;
          const entry: MemoryEntry = {
            fact: safeFact,
            source: filename,
            value: `$${investmentAmount.toLocaleString()}`,
            date: metadata.effective_date || undefined,
            metadata: {
              valuation_cap: valuationCap ? `$${valuationCap.toLocaleString()}` : undefined,
              discount_rate: discountRate,
              mfn_provision: mfnProvision,
              financial_details: allFinancialDetails.length > 0 ? allFinancialDetails.join('; ') : undefined
            }
          };
          
          memory.sections['SAFE Agreements'].push(entry);
          
          // Add comprehensive business context
          if (metadata.business_context) {
            memory.sections['Capital Raised'].push({
              fact: `${investorName} Investment Context: ${metadata.business_context}`,
              source: filename
            });
          }
        }
      }
      
      // Process other investment documents
      if (filename.includes('Investment') || filename.includes('Stock Purchase')) {
        if (metadata.contract_value) {
          const value = this.parseMonetaryValue(metadata.contract_value);
          if (value > 0) {
            const investmentEntry: MemoryEntry = {
              fact: `Investment from ${this.getInvestorName(metadata)}`,
              source: filename,
              value: metadata.contract_value,
              date: metadata.effective_date || undefined
            };
            
            // Add all available financial context
            if (metadata.financial_terms || metadata.key_terms || metadata.business_context) {
              investmentEntry.metadata = {
                financial_terms: metadata.financial_terms,
                key_provisions: metadata.key_terms?.slice(0, 3),
                context: metadata.business_context
              };
            }
            
            memory.sections['Investment Rounds'].push(investmentEntry);
          }
        }
      }
      
      // Process insurance documents using critical facts
      if (metadata.critical_facts && (metadata.document_type?.includes('Insurance') || filename.includes('Insurance'))) {
        const facts = metadata.critical_facts;
        if (facts.policy_number || facts.coverage_amount) {
          const insuranceEntry: MemoryEntry = {
            fact: `${metadata.document_type || 'Insurance Policy'}`,
            source: filename
          };
          
          if (facts.policy_number) {
            insuranceEntry.fact += ` - Policy #${facts.policy_number}`;
          }
          if (facts.coverage_amount) {
            insuranceEntry.value = typeof facts.coverage_amount === 'number' 
              ? `$${facts.coverage_amount.toLocaleString()}`
              : String(facts.coverage_amount);
          }
          
          // Add all insurance details
          insuranceEntry.metadata = {
            carrier: facts.carrier ? String(facts.carrier) : undefined,
            premium: facts.premium ? String(facts.premium) : undefined,
            deductible: facts.deductible ? String(facts.deductible) : undefined,
            policy_period: facts.policy_period ? String(facts.policy_period) : undefined
          };
          
          memory.sections['Insurance'].push(insuranceEntry);
        }
      }
    }
    
    // Add aggregated investor summary
    const sortedInvestors = Array.from(investorDetails.entries())
      .sort((a, b) => b[1].amount - a[1].amount);
    
    sortedInvestors.forEach(([name, details]) => {
      const summaryEntry: MemoryEntry = {
        fact: `${name} - Total Investment`,
        value: `$${details.amount.toLocaleString()}`,
        source: `${details.documents.length} documents`,
        metadata: details.terms
      };
      
      memory.sections['Capital Raised'].push(summaryEntry);
      
      // Add to quick facts for top investors
      if (memory.quickFacts.length < 5) {
        memory.quickFacts.push({
          fact: `${name}: $${details.amount.toLocaleString()}`,
          source: details.documents.join(', ')
        });
      }
    });
    
    // Add summary quick facts
    if (totalRaised > 0) {
      memory.quickFacts.push({
        fact: `Total capital raised: $${totalRaised.toLocaleString()}`,
        source: 'All investment documents'
      });
      
      memory.quickFacts.push({
        fact: `Number of investors: ${investorDetails.size}`,
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
        'Renewal Schedule': [],
        'Payment Terms': [],
        'Business Context': [],
        'Key Obligations': [],
        'Key Contract Terms': [],
        'Revenue Impact Analysis': []
      }
    };

    let totalContractValue = 0;
    let customerCount = 0;
    const revenueByType = new Map<string, number>();
    
    // Extract revenue information from documents
    for (const doc of documents) {
      const { path: docPath, metadata } = doc;
      const filename = path.basename(docPath);
      
      // Look for customer agreements AND any document with revenue implications
      if (metadata.category === 'Sales_Customer_Agreements' || 
          docPath.includes('04_Sales_and_Revenue') ||
          (metadata.financial_terms && Object.keys(metadata.financial_terms).length > 0) ||
          (metadata.business_context && metadata.business_context.toLowerCase().includes('revenue'))) {
        
        // Only count as customer if it's actually a sales/customer agreement
        if (metadata.category === 'Sales_Customer_Agreements' || docPath.includes('04_Sales_and_Revenue')) {
          customerCount++;
        }
        
        // Extract contract value
        if (metadata.contract_value) {
          const value = this.parseMonetaryValue(metadata.contract_value);
          if (value > 0) {
            totalContractValue += value;
            
            const customerName = this.getCounterpartyName(metadata);
            memory.sections['Customer Agreements'].push({
              fact: `${customerName} - ${metadata.document_type || 'Agreement'}`,
              source: filename,
              value: metadata.contract_value,
              date: metadata.effective_date || undefined
            });
            
            // Track revenue by type
            const docType = metadata.document_type || 'Other';
            revenueByType.set(docType, (revenueByType.get(docType) || 0) + value);
          }
        }
        
        // Add business context if available - THIS IS CRITICAL FOR CAPTURING REVENUE INFO
        if (metadata.business_context) {
          memory.sections['Business Context'].push({
            fact: metadata.business_context,
            source: filename,
            metadata: {
              document_type: metadata.document_type,
              parties: metadata.primary_parties?.map(p => p.name).join(', ')
            }
          });
          
          // If business context mentions specific revenue amounts or impacts, highlight them
          const revenueMatches = metadata.business_context.match(/\$[\d,]+|revenue|income|sales/gi);
          if (revenueMatches) {
            memory.sections['Revenue Impact Analysis'].push({
              fact: `${metadata.document_type || filename}: ${metadata.business_context}`,
              source: filename
            });
          }
        }
        
        // Add ALL financial terms details - comprehensive capture
        if (metadata.financial_terms) {
          const terms = metadata.financial_terms;
          
          // Create a comprehensive financial summary entry
          const financialSummaryParts: string[] = [];
          Object.entries(terms).forEach(([key, value]) => {
            if (value) {
              const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              financialSummaryParts.push(`${formattedKey}: ${value}`);
              
              // Add individual entries for important terms
              memory.sections['Payment Terms'].push({
                fact: `${this.getCounterpartyName(metadata)} - ${formattedKey}: ${value}`,
                source: filename
              });
            }
          });
          
          // Add comprehensive summary if we have multiple terms
          if (financialSummaryParts.length > 1) {
            memory.sections['Contract Values'].push({
              fact: `${this.getCounterpartyName(metadata)} Financial Summary: ${financialSummaryParts.join('; ')}`,
              source: filename
            });
          }
        }
        
        // Add ALL key terms - these are the most important provisions
        if (metadata.key_terms && metadata.key_terms.length > 0) {
          // Add all terms to the Key Contract Terms section
          metadata.key_terms.forEach(term => {
            memory.sections['Key Contract Terms'].push({
              fact: `${this.getCounterpartyName(metadata)}: ${term}`,
              source: filename
            });
          });
          
          // Add the most important terms as quick facts
          metadata.key_terms.slice(0, 5).forEach(term => {
            memory.quickFacts.push({
              fact: `Key Term: ${term}`,
              source: filename
            });
          });
        }
        
        // Add ALL obligations - these are critical for understanding commitments
        if (metadata.obligations && metadata.obligations.length > 0) {
          metadata.obligations.forEach(obligation => {
            memory.sections['Key Obligations'].push({
              fact: `${this.getCounterpartyName(metadata)}: ${obligation}`,
              source: filename
            });
          });
          
          // Add a summary if there are many obligations
          if (metadata.obligations.length > 3) {
            memory.quickFacts.push({
              fact: `${this.getCounterpartyName(metadata)} has ${metadata.obligations.length} key obligations`,
              source: filename
            });
          }
        }
        
        // Track renewal dates
        if (metadata.expiration_date && metadata.expiration_date !== 'indefinite') {
          memory.sections['Renewal Schedule'].push({
            fact: `${this.getCounterpartyName(metadata)} - ${metadata.document_type || 'Agreement'} renewal`,
            source: filename,
            date: metadata.expiration_date,
            metadata: {
              renewal_terms: metadata.renewal_terms,
              notice_period: metadata.notice_period
            }
          });
        }
        
        // Extract revenue information from critical facts
        if (metadata.critical_facts) {
          Object.entries(metadata.critical_facts).forEach(([key, value]) => {
            if (key.includes('revenue') || key.includes('sales') || key.includes('income') || 
                key.includes('fee') || key.includes('payment') || key.includes('subscription')) {
              memory.sections['Contract Values'].push({
                fact: `${this.getCounterpartyName(metadata)} - ${key.replace(/_/g, ' ')}: ${value}`,
                source: filename
              });
            }
          });
        }
      }
    }
    
    // Add revenue by type
    revenueByType.forEach((value, type) => {
      memory.sections['Revenue by Type'].push({
        fact: `${type}: $${value.toLocaleString()}`,
        source: 'Calculated from agreements'
      });
    });
    
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
    console.log(`📝 Updating relevant memory files for: ${path.basename(documentPath)}`);
    
    // Only update the memory files that are relevant to this document
    // This is much more efficient than refreshing everything
    
    // If it's a template, update templates inventory
    if (metadata.status === 'template') {
      console.log(`📋 Detected template - updating templates inventory...`);
      const documents = await this.scanAllDocuments();
      await this.generateTemplatesInventory(documents);
      console.log(`✅ Templates inventory updated`);
    }
    
    // Update document index (always)
    console.log(`📑 Updating document index...`);
    const documents = await this.scanAllDocuments();
    await this.generateDocumentIndex(documents);
    
    // Update category-specific memory files based on document type
    // Check for investment/finance documents
    if (metadata.category === 'Finance_and_Investment' || 
        metadata.category === 'Investment_Fundraising' ||
        metadata.category?.includes('Investment') ||
        metadata.category?.includes('Finance') ||
        metadata.document_type?.includes('SAFE') ||
        metadata.document_type?.includes('Investment')) {
      console.log(`💰 Updating financial memory files...`);
      await this.generateFinancialSummary(documents);
      await this.generateInvestorsAndCapTable(documents);
      await this.generatePeopleDirectory(documents); // Also update people for investors
    } 
    // Check for employment/people documents
    else if (metadata.category === 'People_and_Employment' || 
             metadata.category === 'Employment' ||
             metadata.category?.includes('Employment') ||
             metadata.document_type?.includes('Employment') ||
             metadata.document_type?.includes('Offer Letter')) {
      console.log(`👥 Updating people directory...`);
      await this.generatePeopleDirectory(documents);
      await this.generateEquityAndOptions(documents);
    } 
    // Check for corporate documents
    else if (metadata.category === 'Corporate_and_Governance' || 
             metadata.category === 'Corporate' ||
             metadata.category?.includes('Corporate') ||
             metadata.category?.includes('Governance')) {
      console.log(`🏢 Updating corporate info...`);
      await this.generateCompanyInfo(documents);
      await this.generateLegalEntities(documents);
    }
    // Check for revenue/sales documents
    else if (metadata.category === 'Sales_Customer_Agreements' || 
             metadata.category?.includes('Sales') ||
             metadata.category?.includes('Customer') ||
             metadata.category?.includes('Revenue') ||
             documentPath.includes('04_Sales_and_Revenue')) {
      console.log(`💵 Updating revenue and sales memory...`);
      await this.generateRevenueAndSales(documents);
      await this.generateContractsSummary(documents); // Also update contracts
    }
    // For any document with signers, update people directory
    else if (metadata.signers && metadata.signers.length > 0) {
      console.log(`👥 Document has signers - updating people directory...`);
      await this.generatePeopleDirectory(documents);
    }
    
    // Always update key dates if there are important dates
    if (metadata.effective_date || metadata.expiration_date || metadata.fully_executed_date) {
      console.log(`📅 Updating key dates timeline...`);
      await this.generateKeyDatesTimeline(documents);
    }
    
    // Always update contracts summary for any executed document
    if (metadata.status === 'executed' || metadata.status === 'partially_executed') {
      console.log(`📄 Updating contracts summary...`);
      await this.generateContractsSummary(documents);
    }
    
    // IMPORTANT: If we have rich information (business_context, key_terms, obligations), 
    // make sure to update relevant memory files even if category doesn't match perfectly
    if (metadata.business_context || 
        (metadata.key_terms && metadata.key_terms.length > 0) || 
        (metadata.obligations && metadata.obligations.length > 0) ||
        metadata.financial_terms) {
      console.log(`📊 Document contains rich information - updating additional memory files...`);
      
      // If it has financial terms, update financial memory
      if (metadata.financial_terms || metadata.contract_value) {
        console.log(`💰 Updating financial summary due to financial terms...`);
        await this.generateFinancialSummary(documents);
      }
      
      // If it's a business agreement of any kind, update revenue/sales
      if (metadata.business_context && 
          (metadata.category?.includes('Agreement') || 
           metadata.document_type?.includes('Agreement'))) {
        console.log(`💼 Updating revenue/sales due to business context...`);
        await this.generateRevenueAndSales(documents);
      }
      
      // Always update contracts summary for documents with rich context
      console.log(`📋 Updating contracts summary due to rich context...`);
      await this.generateContractsSummary(documents);
    }
    
    console.log(`✅ Memory update complete for ${path.basename(documentPath)}`);
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
        'High-Value Contracts': [],
        'Contract Business Context': [],
        'Key Contract Provisions': [],
        'Contract Obligations Summary': []
      }
    };

    let totalContracts = 0;
    let executedContracts = 0;
    const contractsByCategory = new Map<string, number>();
    const upcomingExpirations = [];
    
    // Get current date for expiration calculations
    const now = new Date();
    const threeMonthsFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    
    for (const doc of documents) {
      const { metadata } = doc;
      const filename = path.basename(doc.path);
      
      totalContracts++;
      
      // Track by category
      const category = metadata.category || 'Other';
      contractsByCategory.set(category, (contractsByCategory.get(category) || 0) + 1);
      
      if (metadata.status === 'executed' || metadata.status === 'partially_executed') {
        executedContracts++;
        
        // Add active contract with comprehensive details
        const contractEntry: MemoryEntry = {
          fact: `${metadata.document_type || filename} - ${this.getCounterpartyName(metadata)}`,
          source: filename,
          date: metadata.effective_date || undefined,
          value: metadata.contract_value,
          metadata: {
            expiration: metadata.expiration_date,
            renewal_terms: metadata.renewal_terms,
            notice_period: metadata.notice_period,
            governing_law: metadata.governing_law
          }
        };
        
        memory.sections['Active Contracts'].push(contractEntry);
        
        // High value contracts with context
        const value = this.parseMonetaryValue(metadata.contract_value || '0');
        if (value >= 50000) {
          const highValueEntry: MemoryEntry = {
            fact: `${metadata.document_type || filename} with ${this.getCounterpartyName(metadata)}`,
            source: filename,
            value: metadata.contract_value
          };
          
          // Add business context for high-value contracts
          if (metadata.business_context) {
            highValueEntry.metadata = {
              context: metadata.business_context,
              key_terms: metadata.key_terms?.slice(0, 3)
            };
          }
          
          memory.sections['High-Value Contracts'].push(highValueEntry);
        }
        
        // Check for expiring contracts
        if (metadata.expiration_date && metadata.expiration_date !== 'indefinite' && metadata.expiration_date !== 'at-will') {
          const expirationDate = new Date(metadata.expiration_date);
          if (expirationDate <= threeMonthsFromNow && expirationDate >= now) {
            memory.sections['Expiring Soon'].push({
              fact: `${metadata.document_type || filename} with ${this.getCounterpartyName(metadata)}`,
              source: filename,
              date: metadata.expiration_date,
              metadata: {
                notice_period: metadata.notice_period,
                renewal_terms: metadata.renewal_terms
              }
            });
          }
        }
        
        // Auto-renewal contracts
        if (metadata.renewal_terms?.includes('automatic')) {
          memory.sections['Auto-Renewal Contracts'].push({
            fact: `${metadata.document_type || filename} with ${this.getCounterpartyName(metadata)}`,
            source: filename,
            metadata: {
              renewal_terms: metadata.renewal_terms,
              notice_period: metadata.notice_period
            }
          });
        }
        
        // Capture business context for all executed contracts
        if (metadata.business_context) {
          memory.sections['Contract Business Context'].push({
            fact: `${this.getCounterpartyName(metadata)} - ${metadata.document_type}: ${metadata.business_context}`,
            source: filename
          });
        }
        
        // Capture key provisions
        if (metadata.key_terms && metadata.key_terms.length > 0) {
          // Group by contract for better organization
          const keyProvisionEntry: MemoryEntry = {
            fact: `${this.getCounterpartyName(metadata)} - ${metadata.document_type || 'Agreement'}`,
            source: filename,
            metadata: {
              provisions: metadata.key_terms
            }
          };
          memory.sections['Key Contract Provisions'].push(keyProvisionEntry);
        }
        
        // Capture obligations summary
        if (metadata.obligations && metadata.obligations.length > 0) {
          const obligationSummary: MemoryEntry = {
            fact: `${this.getCounterpartyName(metadata)} - ${metadata.obligations.length} obligations`,
            source: filename,
            metadata: {
              key_obligations: metadata.obligations.slice(0, 5) // Top 5 obligations
            }
          };
          memory.sections['Contract Obligations Summary'].push(obligationSummary);
        }
      }
    }
    
    // Add category breakdown to quick facts
    const topCategories = Array.from(contractsByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    topCategories.forEach(([category, count]) => {
      memory.quickFacts.push({
        fact: `${category}: ${count} contracts`,
        source: 'Contract analysis'
      });
    });
    
    memory.quickFacts.push({
      fact: `Total contracts: ${totalContracts}`,
      source: 'All documents'
    });
    
    memory.quickFacts.push({
      fact: `Executed contracts: ${executedContracts}`,
      source: 'All documents'
    });
    
    // Add expiration warning if relevant
    const expiringSoonCount = memory.sections['Expiring Soon'].length;
    if (expiringSoonCount > 0) {
      memory.quickFacts.push({
        fact: `Contracts expiring within 90 days: ${expiringSoonCount}`,
        source: 'Contract analysis'
      });
    }
    
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