/**
 * Webhook signature validation using HMAC-SHA256
 */

import { createHmac } from 'crypto';

/**
 * Validates webhook signature to ensure request authenticity
 * @param payload - Raw request body as string
 * @param signature - Signature from webhook header
 * @param secret - Shared secret for validation
 * @returns true if signature is valid, false otherwise
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // If no signature provided, validation fails
    if (!signature || !secret) {
      return false;
    }

    // Create HMAC-SHA256 hash of the payload
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures using timing-safe comparison
    return timingSafeEqual(signature, expectedSignature);
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns true if strings match, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
