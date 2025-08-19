import { drive_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

export class GoogleDriveService {
  private drive: drive_v3.Drive;
  private authClient: OAuth2Client;

  constructor(authClient: OAuth2Client) {
    this.authClient = authClient;
    this.drive = google.drive({ version: 'v3', auth: authClient });
  }

  /**
   * List files in a specific folder
   */
  async listFiles(folderId: string, pageSize: number = 100): Promise<DriveFile[]> {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        pageSize,
        fields: 'files(id, name, mimeType, size, modifiedTime, parents, webViewLink, webContentLink)',
        orderBy: 'createdTime desc'
      });

      return response.data.files as DriveFile[];
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId: string, destPath: string): Promise<void> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(destPath);
        response.data
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err))
          .pipe(dest);
      });
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    filePath: string,
    fileName: string,
    parentFolderId: string,
    mimeType?: string
  ): Promise<DriveFile> {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId]
      };

      const media = {
        mimeType: mimeType || 'application/octet-stream',
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, size, modifiedTime, parents, webViewLink, webContentLink'
      });

      return response.data as DriveFile;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Move a file to a different folder
   */
  async moveFile(fileId: string, newParentId: string): Promise<void> {
    try {
      // First, get the current parent(s)
      const file = await this.drive.files.get({
        fileId,
        fields: 'parents'
      });

      const previousParents = file.data.parents?.join(',');

      // Move the file to the new parent
      await this.drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id, parents'
      });
    } catch (error) {
      throw new Error(`Failed to move file: ${error}`);
    }
  }

  /**
   * Create a folder
   */
  async createFolder(folderName: string, parentId?: string): Promise<DriveFolder> {
    try {
      const fileMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, parents'
      });

      return response.data as DriveFolder;
    } catch (error) {
      throw new Error(`Failed to create folder: ${error}`);
    }
  }

  /**
   * Create the organized folder structure
   */
  async createFolderStructure(parentFolderId: string): Promise<Map<string, string>> {
    const folders = [
      '01_Corporate_and_Governance',
      '02_People_and_Employment',
      '03_Finance_and_Investment',
      '04_Sales_and_Revenue',
      '05_Operations_and_Vendors',
      '06_Technology_and_IP',
      '07_Marketing_and_Partnerships',
      '08_Risk_and_Compliance',
      '09_Templates',
      '10_Archive'
    ];

    const folderMap = new Map<string, string>();

    for (const folderName of folders) {
      try {
        // Check if folder already exists
        const existing = await this.findFolderByName(folderName, parentFolderId);
        
        if (existing) {
          folderMap.set(folderName, existing.id);
        } else {
          const folder = await this.createFolder(folderName, parentFolderId);
          folderMap.set(folderName, folder.id);
        }
      } catch (error) {
        console.error(`Error creating folder ${folderName}:`, error);
      }
    }

    return folderMap;
  }

  /**
   * Find a folder by name in a parent folder
   */
  async findFolderByName(folderName: string, parentId: string): Promise<DriveFolder | null> {
    try {
      const response = await this.drive.files.list({
        q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, parents)',
        pageSize: 1
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0] as DriveFolder;
      }

      return null;
    } catch (error) {
      console.error(`Error finding folder: ${error}`);
      return null;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({ fileId });
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<DriveFile> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, parents, webViewLink, webContentLink'
      });

      return response.data as DriveFile;
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error}`);
    }
  }

  /**
   * Update file metadata (custom properties)
   */
  async updateFileProperties(fileId: string, properties: { [key: string]: string }): Promise<void> {
    try {
      await this.drive.files.update({
        fileId,
        requestBody: {
          properties
        }
      });
    } catch (error) {
      throw new Error(`Failed to update file properties: ${error}`);
    }
  }

  /**
   * Get changes since a specific token
   */
  async getChanges(pageToken: string): Promise<{ changes: any[], newPageToken: string }> {
    try {
      const response = await this.drive.changes.list({
        pageToken,
        fields: 'changes(fileId, removed, file(id, name, mimeType, modifiedTime)), newStartPageToken, nextPageToken'
      });

      return {
        changes: response.data.changes || [],
        newPageToken: response.data.nextPageToken || response.data.newStartPageToken || ''
      };
    } catch (error) {
      throw new Error(`Failed to get changes: ${error}`);
    }
  }

  /**
   * Get starting page token for changes
   */
  async getStartPageToken(): Promise<string> {
    try {
      const response = await this.drive.changes.getStartPageToken({});
      return response.data.startPageToken || '';
    } catch (error) {
      throw new Error(`Failed to get start page token: ${error}`);
    }
  }

  /**
   * Set up a watch channel for changes
   */
  async watchFolder(
    folderId: string,
    webhookUrl: string,
    channelId: string,
    token?: string
  ): Promise<any> {
    try {
      const response = await this.drive.files.watch({
        fileId: folderId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: token,
          expiration: (Date.now() + 24 * 60 * 60 * 1000).toString() // 24 hours
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to set up watch: ${error}`);
    }
  }

  /**
   * Stop watching a channel
   */
  async stopWatching(channelId: string, resourceId: string): Promise<void> {
    try {
      await this.drive.channels.stop({
        requestBody: {
          id: channelId,
          resourceId: resourceId
        }
      });
    } catch (error) {
      console.error(`Failed to stop watching: ${error}`);
    }
  }
}