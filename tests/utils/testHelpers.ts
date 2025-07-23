import * as fs from 'fs';
import * as path from 'path';
import { DocumentMetadata, DocumentClassification } from '../../src/types';

export const TEST_TIMEOUT = 30000;

/**
 * Create a temporary test directory
 */
export async function createTestDirectory(basePath: string): Promise<string> {
  const testDir = path.join(basePath, `test-${Date.now()}`);
  await fs.promises.mkdir(testDir, { recursive: true });
  return testDir;
}

/**
 * Clean up test directory
 */
export async function cleanupTestDirectory(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to cleanup test directory: ${dirPath}`, error);
  }
}

/**
 * Create a test file with content
 */
export async function createTestFile(
  dirPath: string, 
  filename: string, 
  content: string
): Promise<string> {
  const filePath = path.join(dirPath, filename);
  await fs.promises.writeFile(filePath, content);
  return filePath;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Mock Discord message
 */
export function createMockDiscordMessage(content: string, attachments: any[] = []) {
  return {
    id: Date.now().toString(),
    content,
    author: {
      id: 'test-user-id',
      username: 'TestUser',
      bot: false
    },
    channel: {
      id: 'test-channel-id',
      send: jest.fn().mockResolvedValue({}),
      startTyping: jest.fn(),
      stopTyping: jest.fn()
    },
    attachments,
    mentions: {
      has: jest.fn().mockReturnValue(false)
    },
    startThread: jest.fn().mockResolvedValue({
      id: 'test-thread-id',
      send: jest.fn().mockResolvedValue({})
    })
  };
}

/**
 * Create a mock file attachment
 */
export function createMockAttachment(
  name: string,
  size: number = 1024000,
  contentType: string = 'application/pdf'
) {
  return {
    id: Date.now().toString(),
    name,
    url: `https://cdn.discordapp.com/attachments/test/${name}`,
    size,
    contentType
  };
}

/**
 * Assert document metadata matches expected values
 */
export function assertMetadata(
  actual: DocumentMetadata,
  expected: Partial<DocumentMetadata>
): void {
  Object.entries(expected).forEach(([key, value]) => {
    expect(actual[key as keyof DocumentMetadata]).toEqual(value);
  });
}

/**
 * Assert classification matches expected values
 */
export function assertClassification(
  actual: DocumentClassification,
  expected: Partial<DocumentClassification>
): void {
  Object.entries(expected).forEach(([key, value]) => {
    expect(actual[key as keyof DocumentClassification]).toEqual(value);
  });
}

/**
 * Create test environment variables
 */
export function setupTestEnv(overrides: Record<string, string> = {}): void {
  process.env = {
    ...process.env,
    OPENAI_API_KEY: 'test-openai-key',
    ORGANIZE_FOLDER_PATH: '/test/organize',
    DISCORD_BOT_TOKEN: 'test-discord-token',
    ...overrides
  };
}

/**
 * Reset mocked functions
 */
export function resetAllMocks(...mocks: any[]): void {
  mocks.forEach(mock => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach(fn => {
        if (typeof fn === 'function' && fn.mockReset) {
          fn.mockReset();
        }
      });
    }
  });
}

/**
 * Simulate file system operations
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  
  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }
  
  fileExists(path: string): boolean {
    return this.files.has(path);
  }
  
  removeFile(path: string): void {
    this.files.delete(path);
  }
  
  clear(): void {
    this.files.clear();
  }
  
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }
}