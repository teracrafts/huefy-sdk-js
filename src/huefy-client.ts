import { HuefyClient as BaseClient } from './client';
import type { HuefyConfig } from './types/config';
import type {
  EmailData,
  SendEmailOptions,
  SendEmailRequest,
  SendEmailResponse,
  BulkEmailResult,
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
    emails: Array<{
      templateKey: string;
      data: EmailData;
      recipient: string;
      options?: SendEmailOptions;
    }>,
  ): Promise<BulkEmailResult[]> {
    if (!emails || !Array.isArray(emails)) {
      throw new HuefyDomainError(
        'emails parameter is required and must be an array',
        HuefyErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    const countError = validateBulkCount(emails.length);
    if (countError) {
      throw new HuefyDomainError(countError, HuefyErrorCode.VALIDATION_ERROR, 400);
    }

    const requests: SendEmailRequest[] = emails.map((email) => {
      warnIfPotentialPII(email.data as Record<string, unknown>, 'email template data', this.logger);
      const errors = validateSendEmailInput(email.templateKey, email.data, email.recipient);
      if (errors.length > 0) {
        throw new HuefyDomainError(
          `Validation failed for ${email.recipient}: ${errors.join('; ')}`,
          HuefyErrorCode.VALIDATION_ERROR,
          400,
          { validationErrors: errors },
        );
      }
      return {
        templateKey: email.templateKey.trim(),
        data: email.data,
        recipient: email.recipient.trim(),
        providerType: email.options?.provider,
      };
    });

    const response = await this.http.request<{ results: BulkEmailResult[] }>(
      '/emails/bulk',
      {
        method: 'POST',
        body: { emails: requests } as unknown as Record<string, unknown>,
      },
    );
    return response.results;
  }

  override async healthCheck(): Promise<HealthResponse> {
    return this.http.request<HealthResponse>('/health', { method: 'GET' });
  }
}
