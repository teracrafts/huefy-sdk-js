export type EmailProvider = 'ses' | 'sendgrid' | 'mailgun' | 'mailchimp';

export interface EmailData {
  [key: string]: string;
}

export interface SendEmailOptions {
  provider?: EmailProvider;
}

export interface SendEmailRequest {
  templateKey: string;
  data: EmailData;
  recipient: string;
  providerType?: EmailProvider;
}

export interface SendEmailResponse {
  success: boolean;
  message: string;
  messageId: string;
  provider: EmailProvider;
}

export interface BulkEmailResult {
  email: string;
  success: boolean;
  result?: SendEmailResponse;
  error?: { message: string; code: string };
}

export interface BulkEmailResponse {
  results: BulkEmailResult[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}
