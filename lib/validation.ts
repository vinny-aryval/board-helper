/**
 * Webhook signature validation using HMAC-SHA256
 */

import { createHmac, timingSafeEqual } from 'crypto';

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

    // Compare signatures using Node.js built-in timing-safe comparison
    // Convert strings to buffers for secure comparison
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    // Ensure same length before comparison
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

