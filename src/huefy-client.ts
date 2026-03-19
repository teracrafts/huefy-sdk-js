import { HuefyClient as BaseClient } from './client';
import type { HuefyConfig } from './types/config';
import type {
  EmailData,
  SendEmailOptions,
  SendEmailRequest,
  SendEmailResponse,
  BulkRecipient,
  SendBulkEmailsRequest,
  SendBulkEmailsResponse,
  HealthResponse,
} from './types/email';
import { validateSendEmailInput, validateBulkCount } from './validators/email-validators';
import { HuefyDomainError } from './errors/huefy-errors';
import { HuefyErrorCode } from './errors/huefy-error-codes';
import { warnIfPotentialPII } from './utils/security';

export class HuefyEmailClient extends BaseClient {
  constructor(config: HuefyConfig) {
    super(config);
  }

  async sendEmail(
    templateKey: string,
    data: EmailData,
    recipient: string,
    options?: SendEmailOptions,
  ): Promise<SendEmailResponse> {
    warnIfPotentialPII(data as Record<string, unknown>, 'email template data', this.logger);

    const errors = validateSendEmailInput(templateKey, data, recipient);
    if (errors.length > 0) {
      throw new HuefyDomainError(
        errors.join('; '),
        HuefyErrorCode.VALIDATION_ERROR,
        400,
        { validationErrors: errors },
      );
    }

    const payload: SendEmailRequest = {
      templateKey: templateKey.trim(),
      data,
      recipient: recipient.trim(),
      providerType: options?.provider,
    };

    return this.http.request<SendEmailResponse>('/emails/send', {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
    });
  }

  async sendBulkEmails(
    templateKey: string,
    recipients: BulkRecipient[],
    options?: {
      providerType?: string;
      fromEmail?: string;
      fromName?: string;
      replyTo?: string;
      batchSize?: number;
      delayBetweenBatches?: string;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<SendBulkEmailsResponse> {
    if (!recipients || !Array.isArray(recipients)) {
      throw new HuefyDomainError(
        'recipients parameter is required and must be an array',
        HuefyErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    const countError = validateBulkCount(recipients.length);
    if (countError) {
      throw new HuefyDomainError(countError, HuefyErrorCode.VALIDATION_ERROR, 400);
    }

    if (!templateKey || typeof templateKey !== 'string' || templateKey.trim().length === 0) {
      throw new HuefyDomainError(
        'templateKey is required',
        HuefyErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    for (const recipient of recipients) {
      if (recipient.data) {
        warnIfPotentialPII(recipient.data as Record<string, unknown>, 'email template data', this.logger);
      }
    }

    const payload: SendBulkEmailsRequest = {
      templateKey: templateKey.trim(),
      recipients,
      ...options,
    };

    return this.http.request<SendBulkEmailsResponse>('/emails/send-bulk', {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
    });
  }

  override async healthCheck(): Promise<HealthResponse> {
    return this.http.request<HealthResponse>('/health', { method: 'GET' });
  }
}
