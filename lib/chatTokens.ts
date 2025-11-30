/**
 * Chat Token Management
 * Generates secure tokens for booking chat rooms
 */

const crypto = require('crypto');

/**
 * Generate a secure chat token for booking room access
 */
export function generateChatToken(bookingId: string, userId: string, role: 'customer' | 'service_provider'): string {
  const payload = {
    bookingId,
    userId,
    role,
    timestamp: Date.now()
  };
  
  const token = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload) + process.env.JWT_SECRET)
    .digest('hex')
    .substring(0, 32);
  
  return `${bookingId}_${role}_${token}`;
}

/**
 * Verify chat token
 */
export function verifyChatToken(token: string, bookingId: string, userId: string, role: 'customer' | 'service_provider'): boolean {
  try {
    const parts = token.split('_');
    if (parts.length !== 3) return false;
    
    const [tokenBookingId, tokenRole, tokenHash] = parts;
    
    if (tokenBookingId !== bookingId || tokenRole !== role) return false;
    
    // Regenerate token and compare
    const expectedToken = generateChatToken(bookingId, userId, role);
    return expectedToken === token;
  } catch {
    return false;
  }
}

/**
 * Extract booking ID and role from token
 */
export function parseChatToken(token: string): { bookingId: string; role: 'customer' | 'service_provider' } | null {
  try {
    const parts = token.split('_');
    if (parts.length < 3) return null;
    
    return {
      bookingId: parts[0],
      role: parts[1] as 'customer' | 'service_provider'
    };
  } catch {
    return null;
  }
}

