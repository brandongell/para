import { DocumentBuilder } from './builders';

/**
 * Edge case documents for comprehensive testing
 */
export const edgeCaseDocuments = {
  // Document with multiple amendments
  multipleAmendments: new DocumentBuilder()
    .withPath('/test/MSA_v3_Amendment_2_Final_Consolidated.pdf')
    .withContent(`MASTER SERVICE AGREEMENT - SECOND AMENDMENT
    
This Second Amendment ("Amendment") to the Master Service Agreement dated January 1, 2023,
as amended by the First Amendment dated June 15, 2023 (collectively, the "Agreement"),
is entered into as of December 1, 2023...`)
    .withDocumentType('Amendment to MSA')
    .withStatus('executed')
    .withSigners(
      { name: 'Alice Johnson', date: '2023-12-01' },
      { name: 'Bob Smith', date: '2023-12-02' }
    )
    .withCriticalFacts({
      amendment_number: '2',
      original_agreement_date: '2023-01-01',
      first_amendment_date: '2023-06-15',
      material_changes: 'Payment terms, SLA modifications'
    })
    .build(),

  // International contract with foreign currency
  internationalContract: new DocumentBuilder()
    .withPath('/test/EU_Data_Processing_Agreement_€_VAT.pdf')
    .withContent(`DATA PROCESSING AGREEMENT
    
Between: TechCorp GmbH (Germany) and DataServices Ltd (UK)
Contract Value: €25,750.50 (excluding 19% VAT)
Governing Law: European Union - GDPR compliant...`)
    .withDocumentType('Data Processing Agreement')
    .withStatus('executed')
    .withContractValue('€25,750.50')
    .withGoverningLaw('European Union - GDPR')
    .withParties(
      { name: 'TechCorp GmbH', organization: 'TechCorp GmbH', role: 'Controller', address: 'Berlin, Germany' },
      { name: 'DataServices Ltd', organization: 'DataServices Ltd', role: 'Processor', address: 'London, UK' }
    )
    .withCriticalFacts({
      currency: 'EUR',
      vat_rate: '19%',
      total_with_vat: '€30,642.10',
      gdpr_compliant: true,
      data_retention_period: '3 years'
    })
    .build(),

  // Complex multi-party agreement with partial execution
  complexMultiParty: new DocumentBuilder()
    .withPath('/test/Joint_Venture_5_Parties_Partial.pdf')
    .withContent(`JOINT VENTURE AGREEMENT
    
This Agreement is entered into among Company A, Company B, Company C, Company D, and Company E...`)
    .withDocumentType('Joint Venture Agreement')
    .withStatus('partially_executed')
    .withSigners(
      { name: 'Company A Representative', date: '2024-01-01' },
      { name: 'Company B Representative', date: '2024-01-02' },
      { name: 'Company C Representative', date: null },
      { name: 'Company D Representative', date: '2024-01-03' },
      { name: 'Company E Representative', date: null }
    )
    .withCriticalFacts({
      total_parties: 5,
      signed_parties: 3,
      pending_signatures: 2,
      unanimous_consent_required: true,
      equity_split: '20% each party'
    })
    .build(),

  // Visual signature only (scanned document)
  visualSignatureOnly: new DocumentBuilder()
    .withPath('/test/Scanned_Handwritten_Agreement.pdf')
    .withContent('[Binary PDF data - no text layer]')
    .withDocumentType('Handwritten Agreement')
    .withStatus('executed')
    .withGeminiExtraction({
      extracted_text: 'Agreement between John Doe and Jane Smith...',
      visual_elements: {
        signatures_detected: 2,
        handwritten_sections: true,
        stamps_detected: 1,
        quality: 'medium'
      },
      confidence: 0.85
    })
    .withSigners(
      { name: 'John Doe', date: '2024-01-15' },
      { name: 'Jane Smith', date: '2024-01-15' }
    )
    .withCriticalFacts({
      extraction_method: 'gemini_visual',
      scan_quality: 'medium',
      handwritten: true
    })
    .build(),

  // Document with special characters and unicode
  unicodeFilename: new DocumentBuilder()
    .withPath('/test/合同_Contract_中文_español_№123.pdf')
    .withContent('International contract with multilingual parties...')
    .withDocumentType('International Trade Agreement')
    .withParties(
      { name: '李明', organization: '北京科技有限公司', role: 'Seller' },
      { name: 'José García', organization: 'España Imports S.L.', role: 'Buyer' }
    )
    .build(),

  // Very large document (performance test)
  largeDocument: new DocumentBuilder()
    .withPath('/test/Complete_Merger_Agreement_500pages.pdf')
    .withContent('X'.repeat(10 * 1024 * 1024)) // 10MB of content
    .withDocumentType('Merger Agreement')
    .withCriticalFacts({
      page_count: 500,
      file_size_mb: 25,
      processing_required: 'batch'
    })
    .build(),

  // Template with complex placeholders
  complexTemplate: new DocumentBuilder()
    .withPath('/test/Master_Agreement_Template_[BLANK]_v2.docx')
    .withContent(`MASTER AGREEMENT TEMPLATE

[PARTY_A_NAME] ("Party A"), a [PARTY_A_JURISDICTION] [PARTY_A_ENTITY_TYPE]
[PARTY_B_NAME] ("Party B"), a [PARTY_B_JURISDICTION] [PARTY_B_ENTITY_TYPE]

Effective Date: [EFFECTIVE_DATE]
Term: [TERM_YEARS] years with [RENEWAL_TERMS]

{{#if INCLUDE_EXHIBIT_A}}
See Exhibit A for detailed terms
{{/if}}`)
    .withStatus('template')
    .withTemplateAnalysis({
      is_template: true,
      confidence: 'HIGH',
      indicators: ['[BLANK] in filename', 'Multiple placeholder fields', 'No signatures'],
      template_type: 'Master Service Agreement',
      field_placeholders: [
        '[PARTY_A_NAME]', '[PARTY_A_JURISDICTION]', '[PARTY_A_ENTITY_TYPE]',
        '[PARTY_B_NAME]', '[PARTY_B_JURISDICTION]', '[PARTY_B_ENTITY_TYPE]',
        '[EFFECTIVE_DATE]', '[TERM_YEARS]', '[RENEWAL_TERMS]'
      ],
      typical_use_case: 'Standardized master agreement for various business relationships'
    })
    .build(),

  // Document with metadata extraction challenges
  poorQualityDocument: new DocumentBuilder()
    .withPath('/test/Faxed_Contract_Poor_Quality.pdf')
    .withContent('Partially readable content with § symbols and €uro amounts...')
    .withGeminiExtraction({
      extraction_confidence: 0.65,
      unreadable_sections: ['Page 3, Section 4.2', 'Signature block'],
      quality_issues: ['Low resolution', 'Skewed pages', 'Fax artifacts']
    })
    .withCriticalFacts({
      quality_score: 0.65,
      manual_review_required: true,
      extraction_warnings: ['Low confidence in monetary values', 'Signature dates unclear']
    })
    .build(),

  // Zero-byte file
  emptyFile: new DocumentBuilder()
    .withPath('/test/Empty_Document.pdf')
    .withContent('')
    .build(),

  // File with path traversal attempt
  pathTraversalAttempt: new DocumentBuilder()
    .withPath('/test/../../../etc/passwd')
    .withContent('Malicious content attempt')
    .build(),

  // Document with conflicting metadata
  conflictingMetadata: new DocumentBuilder()
    .withPath('/test/Agreement_Executed_Template_[BLANK].pdf')
    .withContent('This is actually an executed agreement despite the filename...')
    .withStatus('executed')
    .withSigners(
      { name: 'Real Signer 1', date: '2024-01-01' },
      { name: 'Real Signer 2', date: '2024-01-01' }
    )
    .withCriticalFacts({
      filename_mismatch: true,
      actual_status: 'executed',
      filename_suggests: 'template'
    })
    .build()
};