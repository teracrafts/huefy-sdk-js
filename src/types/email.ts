export type EmailProvider = 'ses' | 'sendgrid' | 'mailgun' | 'mailchimp';

export interface EmailData {
  [key: string]: string;
}

export interface SendEmailOptions {
  provider?: EmailProvider;
}

export interface SendEmailRequest {
  templateKey: string;
  data: Record<string, unknown>;
  recipient: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  providerType?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecipientStatus {
  email: string;
  status: string;
  messageId?: string;
  error?: string;
  sentAt?: string | null;
}

export interface SendEmailResponseData {
  emailId: string;
  status: string;
  recipients: RecipientStatus[];
  scheduledAt?: string | null;
  sentAt?: string | null;
}

export interface SendEmailResponse {
  success: boolean;
  data: SendEmailResponseData;
  correlationId: string;
}

export interface BulkRecipient {
  email: string;
  type?: 'to' | 'cc' | 'bcc';
  data?: Record<string, unknown>;
}

export interface SendBulkEmailsRequest {
  templateKey: string;
  recipients: BulkRecipient[];
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  providerType?: string;
  batchSize?: number;
  delayBetweenBatches?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendBulkEmailsResponseData {
  batchId: string;
  status: string;
  templateKey: string;
  totalRecipients: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  suppressedCount: number;
  startedAt: string;
  completedAt?: string | null;
  recipients: RecipientStatus[];
  errors?: Array<{ code: string; message: string; recipient?: string }>;
  metadata?: Record<string, unknown>;
}

export interface SendBulkEmailsResponse {
  success: boolean;
  data: SendBulkEmailsResponseData;
  correlationId: string;
}

export interface HealthResponseData {
  status: string;
  timestamp: string;
  version: string;
}

export interface HealthResponse {
  success: boolean;
  data: HealthResponseData;
  correlationId: string;
}

// Legacy aliases kept for backwards compatibility
export interface BulkEmailResult {
  email: string;
  success: boolean;
  error?: { message: string; code: string };
}

export interface BulkEmailResponse {
  results: BulkEmailResult[];
}
