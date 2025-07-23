export class GeminiPdfService {
  constructor(apiKey: string) {}
  
  async extractMetadataFromPdf(pdfPath: string) {
    return {
      filename: 'test.pdf',
      status: 'executed',
      category: 'Test',
      signers: [],
      fully_executed_date: null,
      document_type: 'Test Document'
    };
  }
}