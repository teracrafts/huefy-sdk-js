import { HuefyClient as BaseClient } from './client';
import type { HuefyConfig } from './types/config';
import type {
  SendEmailInput,
  SendEmailRequest,
  SendEmailResponse,
  SendBulkEmailsInput,
  SendBulkEmailsRequest,
  SendBulkEmailsResponse,
  HealthResponse,
  EmailRecipient,
  SingleRecipient,
} from './types/email';
import { validateSendEmailInput, validateBulkCount, validateEmail, validateRecipient } from './validators/email-validators';
import { HuefyDomainError } from './errors/huefy-errors';
import { HuefyErrorCode } from './errors/huefy-error-codes';
import { warnIfPotentialPII } from './utils/security';

export class HuefyEmailClient extends BaseClient {
  constructor(config: HuefyConfig) {
    super(config);
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResponse> {
    const { templateKey, data, recipient, provider } = input;

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

    const normalizedRecipient = normalizeRecipient(recipient);
    if (typeof normalizedRecipient !== 'string' && normalizedRecipient.data) {
      warnIfPotentialPII(
        normalizedRecipient.data as Record<string, unknown>,
        'recipient template data',
        this.logger,
      );
    }

    const payload: SendEmailRequest = {
      templateKey: templateKey.trim(),
      data,
      recipient: normalizedRecipient,
      providerType: provider,
    };

    return this.http.request<SendEmailResponse>('/emails/send', {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
    });
  }

  async sendBulkEmails(input: SendBulkEmailsInput): Promise<SendBulkEmailsResponse> {
    const { templateKey, recipients, provider } = input;

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
        warnIfPotentialPII(recipient.data as Record<string, unknown>, 'recipient template data', this.logger);
      }

      const emailError = validateEmail(recipient.email);
      if (emailError) {
        throw new HuefyDomainError(emailError, HuefyErrorCode.VALIDATION_ERROR, 400);
      }

      const recipientError = validateRecipient(recipient);
      if (recipientError) {
        throw new HuefyDomainError(recipientError, HuefyErrorCode.VALIDATION_ERROR, 400);
      }
    }

    const payload: SendBulkEmailsRequest = {
      templateKey: templateKey.trim(),
      recipients: recipients.map(normalizeBulkRecipient),
      providerType: provider,
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

function normalizeRecipient(recipient: SingleRecipient): SingleRecipient {
  if (typeof recipient === 'string') {
    return recipient.trim();
  }

  const normalized: EmailRecipient = {
    email: recipient.email.trim(),
  };

  if (recipient.type !== undefined) {
    normalized.type = recipient.type.trim().toLowerCase() as EmailRecipient['type'];
  }

  if (recipient.data !== undefined) {
    normalized.data = recipient.data;
  }

  return normalized;
}

function normalizeBulkRecipient(recipient: SendBulkEmailsInput['recipients'][number]): SendBulkEmailsInput['recipients'][number] {
  return {
    email: recipient.email.trim(),
    ...(recipient.type !== undefined ? { type: recipient.type.trim().toLowerCase() as EmailRecipient['type'] } : {}),
    ...(recipient.data !== undefined ? { data: recipient.data } : {}),
  };
}
