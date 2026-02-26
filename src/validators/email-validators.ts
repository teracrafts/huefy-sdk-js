import type { EmailData } from '../types/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_TEMPLATE_KEY_LENGTH = 100;
const MAX_BULK_EMAILS = 100;

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return 'Recipient email is required';
  }
  const trimmed = email.trim();
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return `Email exceeds maximum length of ${MAX_EMAIL_LENGTH} characters`;
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return `Invalid email address: ${trimmed}`;
  }
  return null;
}

export function validateTemplateKey(templateKey: string): string | null {
  if (!templateKey || typeof templateKey !== 'string') {
    return 'Template key is required';
  }
  const trimmed = templateKey.trim();
  if (trimmed.length === 0) {
    return 'Template key cannot be empty';
  }
  if (trimmed.length > MAX_TEMPLATE_KEY_LENGTH) {
    return `Template key exceeds maximum length of ${MAX_TEMPLATE_KEY_LENGTH} characters`;
  }
  return null;
}

export function validateEmailData(data: EmailData): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Template data must be a non-null object';
  }
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') {
      return `Template data value for key "${key}" must be a string`;
    }
  }
  return null;
}

export function validateBulkCount(count: number): string | null {
  if (count <= 0) {
    return 'At least one email is required';
  }
  if (count > MAX_BULK_EMAILS) {
    return `Maximum of ${MAX_BULK_EMAILS} emails per bulk request`;
  }
  return null;
}

export function validateSendEmailInput(
  templateKey: string,
  data: EmailData,
  recipient: string,
): string[] {
  const errors: string[] = [];
  const keyError = validateTemplateKey(templateKey);
  if (keyError) errors.push(keyError);
  const dataError = validateEmailData(data);
  if (dataError) errors.push(dataError);
  const emailError = validateEmail(recipient);
  if (emailError) errors.push(emailError);
  return errors;
}
