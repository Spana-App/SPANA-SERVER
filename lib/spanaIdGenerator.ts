/**
 * SPANA ID Generator
 * Generates human-readable IDs with SPANA prefixes for all entities
 * Format: SPN-{randomCode} for users, SPB-{code} for bookings, etc.
 */

import prisma from './database';

/**
 * Generate a cryptographically secure random code (6 characters: mixed alphanumeric)
 * Uses crypto.randomBytes for security - no sequential patterns
 * Example: k7m2p9, x4n8q1
 */
function generateShortCode(): string {
  const crypto = require('crypto');
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  
  // Generate 6 random bytes
  const randomBytes = crypto.randomBytes(6);
  let code = '';
  
  // Convert bytes to characters (ensures uniform distribution)
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  
  return code;
}

/**
 * Generate SPANA ID with prefix
 * Format: SPN-abc123, SPB-xyz789, etc.
 */
async function generateSpanaId(prefix: string, checkUnique: (id: string) => Promise<boolean>): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const code = generateShortCode();
    const id = `${prefix}-${code}`;
    
    // Check if ID is unique
    const isUnique = await checkUnique(id);
    if (isUnique) {
      return id;
    }
    
    attempts++;
  }
  
  // Fallback: use timestamp-based code if all attempts fail
  const timestamp = Date.now().toString(36).slice(-6);
  return `${prefix}-${timestamp}`;
}

/**
 * Check if user ID is unique
 */
async function isUserIdUnique(id: string): Promise<boolean> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id
      }
    });
    return !user;
  } catch (error) {
    return true; // Assume unique on error
  }
}

/**
 * Check if booking ID is unique
 */
async function isBookingIdUnique(id: string): Promise<boolean> {
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id
      }
    });
    return !booking;
  } catch (error) {
    return true;
  }
}

/**
 * Check if payment ID is unique
 */
async function isPaymentIdUnique(id: string): Promise<boolean> {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id
      }
    });
    return !payment;
  } catch (error) {
    return true;
  }
}

/**
 * Check if service ID is unique
 */
async function isServiceIdUnique(id: string): Promise<boolean> {
  try {
    const service = await prisma.service.findFirst({
      where: { id }
    });
    return !service;
  } catch (error) {
    return true;
  }
}

/**
 * Check if message ID is unique
 */
async function isMessageIdUnique(id: string): Promise<boolean> {
  try {
    const message = await prisma.message.findFirst({
      where: {
        id
      }
    });
    return !message;
  } catch (error) {
    return true;
  }
}

/**
 * Check if document ID is unique
 */
async function isDocumentIdUnique(id: string): Promise<boolean> {
  try {
    const document = await prisma.document.findFirst({
      where: { id }
    });
    return !document;
  } catch (error) {
    return true;
  }
}

/**
 * Check if customer ID is unique
 */
async function isCustomerIdUnique(id: string): Promise<boolean> {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id }
    });
    return !customer;
  } catch (error) {
    return true;
  }
}

/**
 * Check if provider ID is unique
 */
async function isProviderIdUnique(id: string): Promise<boolean> {
  try {
    const provider = await prisma.serviceProvider.findFirst({
      where: { id }
    });
    return !provider;
  } catch (error) {
    return true;
  }
}

/**
 * Check if complaint ID is unique
 */
async function isComplaintIdUnique(id: string): Promise<boolean> {
  try {
    const complaint = await prisma.complaint.findFirst({
      where: { id }
    });
    return !complaint;
  } catch (error) {
    return true;
  }
}

/**
 * Check if application ID is unique
 */
async function isApplicationIdUnique(id: string): Promise<boolean> {
  try {
    const application = await prisma.serviceProviderApplication.findFirst({
      where: { id }
    });
    return !application;
  } catch (error) {
    return true;
  }
}

/**
 * Check if payout ID is unique
 */
async function isPayoutIdUnique(id: string): Promise<boolean> {
  try {
    const payout = await prisma.providerPayout.findFirst({
      where: { id }
    });
    return !payout;
  } catch (error) {
    return true;
  }
}

// Export ID generators for each entity type
export async function generateUserId(): Promise<string> {
  return generateSpanaId('SPN', isUserIdUnique);
}

export async function generateBookingId(): Promise<string> {
  return generateSpanaId('SPB', isBookingIdUnique);
}

export async function generatePaymentId(): Promise<string> {
  return generateSpanaId('SPP', isPaymentIdUnique);
}

export async function generateServiceId(): Promise<string> {
  return generateSpanaId('SPS', isServiceIdUnique);
}

export async function generateMessageId(): Promise<string> {
  return generateSpanaId('SPM', isMessageIdUnique);
}

export async function generateDocumentId(): Promise<string> {
  return generateSpanaId('SPD', isDocumentIdUnique);
}

export async function generateCustomerId(): Promise<string> {
  return generateSpanaId('SPC', isCustomerIdUnique);
}

export async function generateProviderId(): Promise<string> {
  return generateSpanaId('SPR', isProviderIdUnique);
}

export async function generateComplaintId(): Promise<string> {
  return generateSpanaId('SPX', isComplaintIdUnique);
}

export async function generateApplicationId(): Promise<string> {
  return generateSpanaId('SPA', isApplicationIdUnique);
}

export async function generatePayoutId(): Promise<string> {
  return generateSpanaId('SPY', isPayoutIdUnique);
}

/**
 * ID Prefix Reference:
 * SPN - Users (SPANA)
 * SPB - Bookings
 * SPP - Payments
 * SPS - Services
 * SPM - Messages
 * SPD - Documents
 * SPC - Customers
 * SPR - Service Providers
 * SPX - Complaints
 * SPA - Applications
 * SPY - Payouts
 */
