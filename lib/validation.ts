/**
 * Webhook signature validation using HMAC-SHA256
 * Uses Web Crypto API for Cloudflare Workers compatibility
 */

/**
 * Validates webhook signature to ensure request authenticity
 * @param payload - Raw request body as string
 * @param signature - Signature from webhook header
 * @param secret - Shared secret for validation
 * @returns true if signature is valid, false otherwise
 */
export async function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // If no signature provided, validation fails
    if (!signature || !secret) {
      return false;
    }

    // Import the secret key for HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Create HMAC-SHA256 hash of the payload
    const payloadData = encoder.encode(payload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);
    
    // Convert to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Timing-safe comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    // Use constant-time comparison
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

