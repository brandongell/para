import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { authenticate } from '@google-cloud/local-auth';

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;
  private config: GoogleAuthConfig;
  private tokenPath: string;

  constructor(config: GoogleAuthConfig) {
    this.config = config;
    this.tokenPath = path.join(process.cwd(), 'token.json');
    
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    // Attempt to load saved credentials
    this.loadSavedCredentials().catch(() => {
      console.log('No saved credentials found. User will need to authenticate.');
    });
  }

  /**
   * Load previously saved credentials
   */
  private async loadSavedCredentials(): Promise<void> {
    try {
      const content = await fs.readFile(this.tokenPath, 'utf-8');
      const credentials = JSON.parse(content);
      this.oauth2Client.setCredentials(credentials);
    } catch (err) {
      throw new Error('No saved credentials found');
    }
  }

  /**
   * Save credentials for future use
   */
  private async saveCredentials(tokens: any): Promise<void> {
    try {
      await fs.writeFile(this.tokenPath, JSON.stringify(tokens));
      console.log('Credentials saved to', this.tokenPath);
    } catch (err) {
      console.error('Error saving credentials:', err);
    }
  }

  /**
   * Get authorization URL for user consent
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent' // Force consent to ensure refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async handleAuthorizationCode(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      await this.saveCredentials(tokens);
    } catch (error) {
      throw new Error(`Failed to exchange authorization code: ${error}`);
    }
  }

  /**
   * Get authenticated OAuth2 client
   */
  async getAuthenticatedClient(): Promise<OAuth2Client> {
    // Check if we have valid credentials
    if (!this.oauth2Client.credentials || !this.oauth2Client.credentials.access_token) {
      throw new Error('Not authenticated. Please complete OAuth flow first.');
    }

    // Check if token needs refresh
    if (this.oauth2Client.credentials.expiry_date) {
      const now = new Date().getTime();
      if (this.oauth2Client.credentials.expiry_date <= now) {
        try {
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          this.oauth2Client.setCredentials(credentials);
          await this.saveCredentials(credentials);
        } catch (error) {
          throw new Error(`Failed to refresh access token: ${error}`);
        }
      }
    }

    return this.oauth2Client;
  }

  /**
   * Interactive authentication for CLI
   */
  async authenticateInteractive(): Promise<OAuth2Client> {
    try {
      // Try to load saved credentials first
      await this.loadSavedCredentials();
      return this.oauth2Client;
    } catch {
      // No saved credentials, initiate OAuth flow
      const client = await authenticate({
        scopes: this.config.scopes,
        keyfilePath: path.join(process.cwd(), 'credentials.json'),
      });

      if (client.credentials) {
        await this.saveCredentials(client.credentials);
      }

      this.oauth2Client = client as OAuth2Client;
      return this.oauth2Client;
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.oauth2Client.credentials && this.oauth2Client.credentials.access_token);
  }

  /**
   * Revoke credentials
   */
  async revokeCredentials(): Promise<void> {
    try {
      await this.oauth2Client.revokeCredentials();
      await fs.unlink(this.tokenPath);
      console.log('Credentials revoked successfully');
    } catch (error) {
      console.error('Error revoking credentials:', error);
    }
  }
}