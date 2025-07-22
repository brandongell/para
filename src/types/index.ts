export interface DocumentClassification {
  primaryFolder: string;
  subfolder: string;
  confidence: number;
  reasoning: string;
}

export interface FileContent {
  content: string;
  filename: string;
  extension: string;
}

export interface OrganizationResult {
  success: boolean;
  originalPath: string;
  newPath?: string;
  metadataPath?: string;
  error?: string;
}

export interface FolderStructure {
  [key: string]: string[];
}

export interface Signer {
  name: string;
  date_signed: string | null;
}

export interface Party {
  name: string;
  organization?: string;
  title?: string;
  address?: string;
  email?: string;
  role?: string; // e.g., "Company", "Investor", "Employee", "Contractor"
}

export interface DocumentMetadata {
  filename: string;
  status: 'not_executed' | 'partially_executed' | 'executed' | 'template';
  category: string;
  signers: Signer[];
  fully_executed_date: string | null;
  document_type?: string;
  primary_parties?: Party[];
  effective_date?: string | null;
  
  // High-priority additional fields
  contract_value?: string; // e.g., "$50000", "€25000", "TBD"
  expiration_date?: string | null; // YYYY-MM-DD or "indefinite", "at-will"
  governing_law?: string; // e.g., "Delaware", "California", "New York"
  counterparty_role?: string; // e.g., "employee", "contractor", "investor", "advisor"
  amendment_number?: string; // e.g., "original", "amendment_1", "v2.1"
  
  // Medium-priority additional fields
  notice_period?: string; // e.g., "30_days", "60_days", "immediate"
  renewal_terms?: string; // e.g., "automatic_annual", "manual_renewal", "fixed_term"
  confidentiality_level?: string; // e.g., "public", "internal", "confidential"
  approval_required?: string; // e.g., "board_approval", "ceo_approval", "standard_authority"
  
  // Existing fields
  tags?: string[];
  notes?: string;
}

export interface MetadataExtractionResult {
  success: boolean;
  metadata?: DocumentMetadata;
  error?: string;
}

export interface BotIntent {
  type: 'ORGANIZE_FILES' | 'SEARCH_DOCUMENTS' | 'GET_DOCUMENT_INFO' | 'LIST_DOCUMENTS' | 'GET_STATISTICS' | 'HELP' | 'UNKNOWN';
  confidence: number;
  parameters: {
    document_type?: string;
    status?: string;
    signer?: string;
    date_range?: {
      start?: string;
      end?: string;
    };
    company?: string;
    category?: string;
    filename?: string;
    query?: string;
  };
}

export interface ConversationContext {
  userId: string;
  lastIntent?: BotIntent;
  lastQuery?: string;
  lastResults?: any[];
  awaitingFollowUp: boolean;
  created: Date;
  updated: Date;
}

export interface BotResponse {
  content: string;
  embeds?: DiscordEmbed[];
  followUpSuggestions?: string[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
  footer?: {
    text: string;
  };
}

export interface SearchResult {
  filename: string;
  path: string;
  metadata?: DocumentMetadata;
  classification?: DocumentClassification;
  relevanceScore: number;
}