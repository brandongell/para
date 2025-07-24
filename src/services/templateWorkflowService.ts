import { 
  TemplateWorkflowState, 
  DocumensoTemplateField, 
  TemplateEntry,
  BotIntent,
  DiscordEmbed
} from '../types';
import { TemplateRegistryService } from './templateRegistryService';
import { DocumensoService } from './documensoService';
import { ConversationManager } from './conversationManager';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowResponse {
  message: string;
  embed?: DiscordEmbed;
  completed: boolean;
  documentId?: number;
  signingLinks?: Array<{ email: string; link: string }>;
}

export class TemplateWorkflowService {
  private templateRegistry: TemplateRegistryService;
  private documensoService: DocumensoService;
  private conversationManager: ConversationManager;
  private activeWorkflows: Map<string, TemplateWorkflowState> = new Map();

  constructor(
    templateRegistry: TemplateRegistryService,
    documensoService: DocumensoService,
    conversationManager: ConversationManager
  ) {
    this.templateRegistry = templateRegistry;
    this.documensoService = documensoService;
    this.conversationManager = conversationManager;
  }

  /**
   * Check if user has an active workflow
   */
  hasActiveWorkflow(userId: string): boolean {
    return this.activeWorkflows.has(userId);
  }

  /**
   * Get the Documenso service instance
   */
  getDocumensoService(): DocumensoService {
    return this.documensoService;
  }

  /**
   * Start a new template workflow
   */
  async startWorkflow(
    userId: string,
    intent: BotIntent
  ): Promise<WorkflowResponse> {
    const { template_name, recipient_email, recipient_name } = intent.parameters;

    if (!template_name) {
      return {
        message: "I couldn't identify which template you want to send. Please specify the template name.",
        completed: true
      };
    }

    // Find matching templates
    const templates = await this.templateRegistry.findTemplates(template_name);

    if (templates.length === 0) {
      return {
        message: `I couldn't find a template matching "${template_name}". Try 'show templates' to see available templates.`,
        completed: true
      };
    }

    if (templates.length > 1) {
      const templateList = templates
        .map((t, i) => `${i + 1}. ${t.metadata.document_type || t.metadata.filename}`)
        .join('\n');
      
      return {
        message: `I found multiple templates matching "${template_name}":\n${templateList}\n\nPlease be more specific or reply with the number of the template you want.`,
        completed: false
      };
    }

    const template = templates[0];

    // Check if template has Documenso ID
    if (!template.documensoTemplateId) {
      return {
        message: `The template "${template.metadata.document_type || template.metadata.filename}" hasn't been uploaded to Documenso yet. Would you like me to upload it first?`,
        completed: false
      };
    }

    // Initialize workflow state
    const workflowState: TemplateWorkflowState = {
      workflowId: uuidv4(),
      templateId: template.documensoTemplateId,
      templateName: template.metadata.document_type || template.metadata.filename,
      currentStep: 'collecting_fields',
      collectedFields: {},
      remainingFields: [], // Will be populated after fetching from Documenso
      recipients: [],
      startedAt: new Date(),
      lastInteraction: new Date()
    };

    // Add recipient if provided in initial message
    if (recipient_email) {
      workflowState.recipients.push({
        email: recipient_email,
        name: recipient_name || recipient_email,
        signingOrder: 1
      });
      workflowState.currentStep = 'collecting_fields';
    }

    // Store workflow state
    this.activeWorkflows.set(userId, workflowState);

    // Fetch template fields from Documenso
    try {
      const templateFields = await this.getTemplateFields(template.documensoTemplateId);
      workflowState.remainingFields = templateFields;

      // If we have recipient and no fields to collect, move to confirmation
      if (workflowState.recipients.length > 0 && templateFields.length === 0) {
        workflowState.currentStep = 'confirming';
        return this.generateConfirmationPrompt(workflowState);
      }

      // Generate first field prompt
      return this.generateNextFieldPrompt(workflowState);
    } catch (error) {
      console.error('Failed to fetch template fields:', error);
      return {
        message: "I encountered an error fetching the template fields. Please try again later.",
        completed: true
      };
    }
  }

  /**
   * Continue an existing workflow with user input
   */
  async continueWorkflow(
    userId: string,
    message: string
  ): Promise<WorkflowResponse> {
    const workflowState = this.activeWorkflows.get(userId);
    if (!workflowState) {
      return {
        message: "No active workflow found. Start by saying something like 'Send the MNDA to john@example.com'",
        completed: true
      };
    }

    workflowState.lastInteraction = new Date();

    // Handle cancellation
    if (this.isCancellation(message)) {
      await this.cancelWorkflow(userId);
      return {
        message: "Workflow cancelled. Let me know if you need anything else!",
        completed: true
      };
    }

    switch (workflowState.currentStep) {
      case 'collecting_fields':
        return this.handleFieldCollection(userId, workflowState, message);
      
      case 'collecting_recipients':
        return this.handleRecipientCollection(userId, workflowState, message);
      
      case 'confirming':
        return this.handleConfirmation(userId, workflowState, message);
      
      case 'sending':
        return {
          message: "Document is already being sent. Please wait...",
          completed: false
        };
      
      default:
        return {
          message: "I'm not sure what to do at this step. Let's start over.",
          completed: true
        };
    }
  }

  /**
   * Handle field value collection
   */
  private async handleFieldCollection(
    userId: string,
    workflowState: TemplateWorkflowState,
    message: string
  ): Promise<WorkflowResponse> {
    if (workflowState.remainingFields.length === 0) {
      // Move to recipient collection if needed
      if (workflowState.recipients.length === 0) {
        workflowState.currentStep = 'collecting_recipients';
        return this.generateRecipientPrompt(workflowState);
      } else {
        workflowState.currentStep = 'confirming';
        return this.generateConfirmationPrompt(workflowState);
      }
    }

    const currentField = workflowState.remainingFields[0];
    
    // Validate field value
    const validationResult = this.validateFieldValue(currentField, message);
    if (!validationResult.valid) {
      return {
        message: validationResult.error || "Invalid value. Please try again.",
        completed: false
      };
    }

    // Store field value
    workflowState.collectedFields[currentField.id] = validationResult.value;
    workflowState.remainingFields.shift();

    // Check if more fields to collect
    if (workflowState.remainingFields.length > 0) {
      return this.generateNextFieldPrompt(workflowState);
    } else if (workflowState.recipients.length === 0) {
      workflowState.currentStep = 'collecting_recipients';
      return this.generateRecipientPrompt(workflowState);
    } else {
      workflowState.currentStep = 'confirming';
      return this.generateConfirmationPrompt(workflowState);
    }
  }

  /**
   * Handle recipient collection
   */
  private async handleRecipientCollection(
    userId: string,
    workflowState: TemplateWorkflowState,
    message: string
  ): Promise<WorkflowResponse> {
    // Parse recipient information from message
    const recipientInfo = this.parseRecipientInfo(message);
    
    if (!recipientInfo.email) {
      return {
        message: "I need a valid email address for the recipient. Please provide their email.",
        completed: false
      };
    }

    workflowState.recipients.push({
      email: recipientInfo.email,
      name: recipientInfo.name || recipientInfo.email,
      signingOrder: workflowState.recipients.length + 1
    });

    workflowState.currentStep = 'confirming';
    return this.generateConfirmationPrompt(workflowState);
  }

  /**
   * Handle confirmation
   */
  private async handleConfirmation(
    userId: string,
    workflowState: TemplateWorkflowState,
    message: string
  ): Promise<WorkflowResponse> {
    const confirmed = this.isConfirmation(message);
    
    if (!confirmed) {
      return {
        message: "Please confirm with 'yes' to send the document, or 'no' to cancel.",
        completed: false
      };
    }

    workflowState.currentStep = 'sending';
    
    try {
      // Create and send document
      const result = await this.documensoService.createAndSendDocument(
        workflowState.templateId,
        workflowState.recipients,
        workflowState.collectedFields,
        {
          title: workflowState.templateName,
          subject: `Please sign: ${workflowState.templateName}`,
          message: `You have been requested to sign ${workflowState.templateName}.`
        }
      );

      // Clean up workflow
      await this.completeWorkflow(userId);

      // Build signing links message
      const signingLinksMessage = result.recipients
        .map(r => `📧 ${r.email} - [Sign Document](${r.signingUrl})`)
        .join('\n');

      return {
        message: `✅ Document sent successfully!\n\n${signingLinksMessage}`,
        embed: {
          title: '📄 Document Sent',
          description: `${workflowState.templateName} has been sent for signature.`,
          color: 0x00ff00,
          fields: [
            {
              name: '🆔 Document ID',
              value: result.documentId.toString(),
              inline: true
            },
            {
              name: '👥 Recipients',
              value: workflowState.recipients.map(r => `${r.name} (${r.email})`).join('\n'),
              inline: false
            },
            {
              name: '📝 Status',
              value: 'Awaiting signatures',
              inline: true
            }
          ],
          footer: {
            text: 'Powered by Documenso • Check your email for signing links'
          }
        },
        completed: true,
        documentId: result.documentId,
        signingLinks: result.recipients.map(r => ({
          email: r.email,
          link: r.signingUrl
        }))
      };
    } catch (error) {
      console.error('Failed to send document:', error);
      this.completeWorkflow(userId);
      
      return {
        message: `❌ Failed to send document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        completed: true
      };
    }
  }

  /**
   * Generate prompt for next field
   */
  private generateNextFieldPrompt(workflowState: TemplateWorkflowState): WorkflowResponse {
    const field = workflowState.remainingFields[0];
    const progress = this.calculateProgress(workflowState);
    
    let prompt = `**${workflowState.templateName}** - Field ${progress.current} of ${progress.total}\n\n`;
    prompt += `Please provide: **${field.name}**`;
    
    if (field.description) {
      prompt += `\n${field.description}`;
    }
    
    if (field.placeholder) {
      prompt += `\n*Example: ${field.placeholder}*`;
    }

    return {
      message: prompt,
      embed: {
        title: 'Collecting Information',
        fields: [
          {
            name: 'Field Type',
            value: field.type,
            inline: true
          },
          {
            name: 'Required',
            value: field.required ? 'Yes' : 'No',
            inline: true
          }
        ],
        footer: {
          text: `Progress: ${progress.current}/${progress.total} | Type 'cancel' to stop`
        }
      },
      completed: false
    };
  }

  /**
   * Generate recipient prompt
   */
  private generateRecipientPrompt(workflowState: TemplateWorkflowState): WorkflowResponse {
    return {
      message: "Who should I send this document to? Please provide their email address and optionally their full name.",
      embed: {
        title: 'Recipient Information',
        description: 'Format: email@example.com or "John Smith <john@example.com>"'
      },
      completed: false
    };
  }

  /**
   * Generate confirmation prompt
   */
  private generateConfirmationPrompt(workflowState: TemplateWorkflowState): WorkflowResponse {
    const fields = Object.entries(workflowState.collectedFields)
      .map(([key, value]) => ({
        name: key,
        value: String(value),
        inline: true
      }));

    return {
      message: "Please review the information below and confirm with 'yes' to send:",
      embed: {
        title: `Ready to send: ${workflowState.templateName}`,
        fields: [
          ...fields,
          {
            name: 'Recipients',
            value: workflowState.recipients.map(r => `${r.name} (${r.email})`).join('\n'),
            inline: false
          }
        ],
        color: 0x0099ff,
        footer: {
          text: "Reply 'yes' to send or 'no' to cancel"
        }
      },
      completed: false
    };
  }

  /**
   * Get template fields from Documenso
   */
  private async getTemplateFields(templateId: string): Promise<DocumensoTemplateField[]> {
    try {
      const fields = await this.documensoService.getTemplateFields(templateId);
      // Filter out signature and initials fields as those are handled by Documenso
      return fields.filter(field => field.type !== 'signature' && field.type !== 'initials');
    } catch (error) {
      console.error('Failed to get template fields:', error);
      // Return empty array if API call fails - template might not have fields
      return [];
    }
  }

  /**
   * Validate field value based on field type
   */
  private validateFieldValue(
    field: DocumensoTemplateField, 
    value: string
  ): { valid: boolean; value?: any; error?: string } {
    const trimmedValue = value.trim();

    if (field.required && !trimmedValue) {
      return { valid: false, error: 'This field is required.' };
    }

    switch (field.type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedValue)) {
          return { valid: false, error: 'Please provide a valid email address.' };
        }
        break;

      case 'date':
        const date = new Date(trimmedValue);
        if (isNaN(date.getTime())) {
          return { valid: false, error: 'Please provide a valid date (YYYY-MM-DD).' };
        }
        return { valid: true, value: trimmedValue };

      case 'number':
        const num = parseFloat(trimmedValue);
        if (isNaN(num)) {
          return { valid: false, error: 'Please provide a valid number.' };
        }
        return { valid: true, value: num };
    }

    // Apply additional validation rules
    if (field.validation) {
      if (field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(trimmedValue)) {
          return { valid: false, error: 'Value does not match required pattern.' };
        }
      }

      if (field.validation.minLength && trimmedValue.length < field.validation.minLength) {
        return { valid: false, error: `Minimum length is ${field.validation.minLength} characters.` };
      }

      if (field.validation.maxLength && trimmedValue.length > field.validation.maxLength) {
        return { valid: false, error: `Maximum length is ${field.validation.maxLength} characters.` };
      }
    }

    return { valid: true, value: trimmedValue };
  }

  /**
   * Parse recipient information from message
   */
  private parseRecipientInfo(message: string): { email?: string; name?: string } {
    const trimmed = message.trim();
    
    // Match patterns like "John Smith <john@example.com>"
    const fullMatch = trimmed.match(/^(.+?)\s*<([^\s@]+@[^\s@]+\.[^\s@]+)>$/);
    if (fullMatch) {
      return { name: fullMatch[1].trim(), email: fullMatch[2] };
    }

    // Match plain email
    const emailMatch = trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    if (emailMatch) {
      return { email: emailMatch[0] };
    }

    // Try to extract email from message
    const embeddedEmail = trimmed.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (embeddedEmail) {
      return { email: embeddedEmail[0] };
    }

    return {};
  }

  /**
   * Check if message is a cancellation
   */
  private isCancellation(message: string): boolean {
    const cancellations = ['cancel', 'stop', 'quit', 'exit', 'nevermind', 'forget it'];
    return cancellations.includes(message.toLowerCase().trim());
  }

  /**
   * Check if message is a confirmation
   */
  private isConfirmation(message: string): boolean {
    const confirmations = ['yes', 'y', 'confirm', 'send', 'ok', 'okay', 'sure'];
    return confirmations.includes(message.toLowerCase().trim());
  }

  /**
   * Calculate workflow progress
   */
  private calculateProgress(workflowState: TemplateWorkflowState): { current: number; total: number } {
    const totalFields = Object.keys(workflowState.collectedFields).length + workflowState.remainingFields.length;
    const current = Object.keys(workflowState.collectedFields).length + 1;
    return { current, total: totalFields };
  }

  /**
   * Cancel workflow
   */
  private async cancelWorkflow(userId: string): Promise<void> {
    this.activeWorkflows.delete(userId);
  }

  /**
   * Complete workflow
   */
  private async completeWorkflow(userId: string): Promise<void> {
    this.activeWorkflows.delete(userId);
  }

  /**
   * Clean up stale workflows
   */
  async cleanupStaleWorkflows(maxAge: number = 30 * 60 * 1000): Promise<void> {
    const now = new Date();
    const staleWorkflows: string[] = [];

    for (const [userId, workflow] of this.activeWorkflows.entries()) {
      if (now.getTime() - workflow.lastInteraction.getTime() > maxAge) {
        staleWorkflows.push(userId);
      }
    }

    for (const userId of staleWorkflows) {
      await this.cancelWorkflow(userId);
    }
  }
}