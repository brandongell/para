import { DocumentMetadata, DocumentClassification, Signer, Party } from '../../src/types';

/**
 * Builder pattern for creating test documents with realistic data
 */
export class DocumentBuilder {
  private document: {
    path: string;
    content: string;
    metadata: DocumentMetadata;
    classification?: DocumentClassification;
    geminiData?: any;
  };

  constructor() {
    this.document = {
      path: '',
      content: '',
      metadata: {
        filename: '',
        status: 'not_executed',
        category: '',
        signers: [],
        fully_executed_date: null
      }
    };
  }

  withPath(path: string): this {
    this.document.path = path;
    this.document.metadata.filename = path.split('/').pop() || '';
    return this;
  }

  withContent(content: string): this {
    this.document.content = content;
    return this;
  }

  withStatus(status: DocumentMetadata['status']): this {
    this.document.metadata.status = status;
    return this;
  }

  withCategory(category: string): this {
    this.document.metadata.category = category;
    return this;
  }

  withDocumentType(type: string): this {
    this.document.metadata.document_type = type;
    return this;
  }

  withSigners(...signers: Array<{name: string, date?: string | null}>): this {
    this.document.metadata.signers = signers.map(s => ({
      name: s.name,
      date_signed: s.date || null
    }));
    
    // Auto-update status based on signers
    if (signers.length > 0 && signers.every(s => s.date)) {
      this.document.metadata.status = 'executed';
      // Set fully executed date to the latest signer date
      const dates = signers.map(s => s.date).filter(Boolean) as string[];
      this.document.metadata.fully_executed_date = dates.sort().pop() || null;
    } else if (signers.some(s => s.date)) {
      this.document.metadata.status = 'partially_executed';
    }
    
    return this;
  }

  withParties(...parties: Array<Partial<Party>>): this {
    this.document.metadata.primary_parties = parties.map(p => ({
      name: p.name || '',
      organization: p.organization,
      title: p.title,
      address: p.address,
      email: p.email,
      role: p.role
    }));
    return this;
  }

  withContractValue(value: string): this {
    this.document.metadata.contract_value = value;
    return this;
  }

  withEffectiveDate(date: string): this {
    this.document.metadata.effective_date = date;
    return this;
  }

  withGoverningLaw(law: string): this {
    this.document.metadata.governing_law = law;
    return this;
  }

  withClassification(classification: Partial<DocumentClassification>): this {
    this.document.classification = {
      primaryFolder: classification.primaryFolder || '10_Archive',
      subfolder: classification.subfolder || 'Unorganized',
      confidence: classification.confidence || 0.5,
      reasoning: classification.reasoning || 'Default classification'
    };
    return this;
  }

  withGeminiExtraction(data: any): this {
    this.document.geminiData = data;
    return this;
  }

  withTemplateAnalysis(analysis: {
    is_template: boolean;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    indicators: string[];
    template_type?: string;
    field_placeholders?: string[];
    typical_use_case?: string;
  }): this {
    this.document.metadata.template_analysis = analysis;
    if (analysis.is_template) {
      this.document.metadata.status = 'template';
    }
    return this;
  }

  withCriticalFacts(facts: Record<string, string | number | boolean>): this {
    this.document.metadata.critical_facts = facts;
    return this;
  }

  withDocumenso(documensoData: {
    document_id?: number;
    template_id?: string;
    template_link?: string;
    status?: 'pending_upload' | 'uploaded' | 'template_created' | 'error';
    uploaded_at?: string;
    error_message?: string;
  }): this {
    this.document.metadata.documenso = documensoData;
    return this;
  }

  build() {
    return { ...this.document };
  }
}

/**
 * Builder for creating search queries with different complexity levels
 */
export class SearchQueryBuilder {
  private query: {
    text: string;
    filters?: {
      status?: string[];
      documentType?: string[];
      dateRange?: { start?: string; end?: string };
      signers?: string[];
      minValue?: number;
      maxValue?: number;
    };
    intent?: string;
  };

  constructor() {
    this.query = { text: '' };
  }

  withText(text: string): this {
    this.query.text = text;
    return this;
  }

  withStatusFilter(...statuses: string[]): this {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters.status = statuses;
    return this;
  }

  withDocumentTypeFilter(...types: string[]): this {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters.documentType = types;
    return this;
  }

  withDateRange(start?: string, end?: string): this {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters.dateRange = { start, end };
    return this;
  }

  withSignerFilter(...signers: string[]): this {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters.signers = signers;
    return this;
  }

  withValueRange(min?: number, max?: number): this {
    if (!this.query.filters) this.query.filters = {};
    if (min !== undefined) this.query.filters.minValue = min;
    if (max !== undefined) this.query.filters.maxValue = max;
    return this;
  }

  withIntent(intent: string): this {
    this.query.intent = intent;
    return this;
  }

  build() {
    return { ...this.query };
  }
}