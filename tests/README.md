# Legal Document Organizer Test Suite

This test suite provides comprehensive testing for the Legal Document Organizer application.

## Test Structure

```
tests/
├── __tests__/
│   ├── unit/           # Unit tests for individual services
│   ├── integration/    # Integration tests for service interactions
│   └── e2e/           # End-to-end workflow tests
├── fixtures/          # Test data and mock documents
├── mocks/            # Service mocks and utilities
├── utils/            # Test helper functions
└── setup.ts          # Jest configuration and global setup
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test suites
```bash
npm test simple           # Run simple unit tests
npm test fileReader      # Run FileReaderService tests
npm test fileOrganizer   # Run FileOrganizerService tests
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests by type
```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # End-to-end tests only
```

## Test Implementation Status

### ✅ Completed Tests

1. **Test Infrastructure**
   - Jest with TypeScript support
   - Test utilities and helpers
   - Mock services and fixtures
   - Basic test structure

2. **Unit Tests**
   - Simple validation tests (types, paths, templates)
   - FileReaderService (with mocking issues to resolve)
   - DocumentClassifierService (with mocking issues to resolve)
   - MetadataService (with mocking issues to resolve)
   - FileOrganizerService (with mocking issues to resolve)

3. **Integration Tests**
   - FileMonitorService workflow
   - Discord bot file upload handling

4. **E2E Tests**
   - Basic file organization workflow
   - Template detection and organization
   - Metadata generation

### 🚧 Pending Tests

1. **Unit Tests**
   - MemoryService
   - EnhancedSmartSearchService
   - OpenAIService
   - GeminiPdfService

2. **Integration Tests**
   - Discord bot search commands
   - Discord bot template requests
   - Memory system updates

3. **Error Handling Tests**
   - API failures
   - File system errors
   - Network issues

## Known Issues

1. **Mocking Challenges**
   - File system operations need proper mocking setup
   - External API services (OpenAI, Gemini) need mock implementations
   - Some services have complex dependencies that require careful mocking

2. **Async Operations**
   - Some tests need better async handling
   - File monitoring tests require proper timing controls

## Test Best Practices

1. **Use Test Fixtures**
   - Import from `tests/fixtures/documents.ts` for consistent test data
   - Create new fixtures for specific test scenarios

2. **Mock External Dependencies**
   - Always mock file system operations in unit tests
   - Mock API calls to avoid rate limits and costs
   - Use manual mocks in `src/services/__mocks__/` for complex services

3. **Test Organization**
   - Keep unit tests focused on single service methods
   - Integration tests should test service interactions
   - E2E tests should simulate real user workflows

4. **Environment Variables**
   - Tests use `.env.test` for configuration
   - Never use real API keys in tests
   - Mock API responses instead of making real calls

## Adding New Tests

1. **Create test file** in appropriate directory:
   - `tests/__tests__/unit/` for unit tests
   - `tests/__tests__/integration/` for integration tests
   - `tests/__tests__/e2e/` for end-to-end tests

2. **Import test utilities**:
   ```typescript
   import { createTestDirectory, cleanupTestDirectory } from '../../utils/testHelpers';
   import { mockDocuments } from '../../fixtures/documents';
   ```

3. **Follow naming convention**:
   - Unit tests: `serviceName.test.ts`
   - Integration tests: `featureName.test.ts`
   - E2E tests: `workflowName.test.ts`

4. **Structure tests clearly**:
   ```typescript
   describe('ServiceName', () => {
     describe('methodName', () => {
       it('should do something specific', () => {
         // Test implementation
       });
     });
   });
   ```

## Continuous Integration

GitHub Actions workflow for automated testing is planned but not yet implemented.

## Contributing

When adding new features, always include corresponding tests:
1. Unit tests for new service methods
2. Integration tests for service interactions
3. E2E tests for user-facing workflows