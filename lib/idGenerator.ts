/**
 * ID Generator with SPANA Prefixes
 * Generates human-readable reference numbers with company branding
 */

// Counter for sequential IDs (in production, use Redis or database sequence)
let bookingCounter = 0;
let paymentCounter = 0;
let userCounter = 0;
let messageCounter = 0;

/**
 * Generate display ID for bookings
 * Format: SPANA-BK-001, SPANA-BK-002, etc.
 */
export function generateBookingReference(): string {
  bookingCounter++;
  const padded = String(bookingCounter).padStart(6, '0');
  return `SPANA-BK-${padded}`;
}

/**
 * Generate display ID for payments
 * Format: SPANA-PY-001, SPANA-PY-002, etc.
 */
export function generatePaymentReference(): string {
  paymentCounter++;
  const padded = String(paymentCounter).padStart(6, '0');
  return `SPANA-PY-${padded}`;
}

/**
 * Generate display ID for users
 * Format: SPN-USR-001, SPN-USR-002, etc.
 */
export function generateUserReference(): string {
  userCounter++;
  const padded = String(userCounter).padStart(6, '0');
  return `SPN-USR-${padded}`;
}

/**
 * Generate display ID for messages
 * Format: SPN-MSG-001, SPN-MSG-002, etc.
 */
export function generateMessageReference(): string {
  messageCounter++;
  const padded = String(messageCounter).padStart(6, '0');
  return `SPN-MSG-${padded}`;
}

/**
 * Generate display ID for services
 * Format: SPN-SVC-001, SPN-SVC-002, etc.
 */
export function generateServiceReference(): string {
  // Implementation would use database counter or Redis
  const padded = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `SPN-SVC-${padded}`;
}

/**
 * Get next sequence number from database
 * Uses database to ensure uniqueness across instances
 */
export async function getNextSequence(type: 'booking' | 'payment' | 'user' | 'message' | 'service'): Promise<number> {
  try {
    const prisma = require('./database').default;
    
    // Use Prisma model (recommended - handles schema correctly)
    try {
      const sequence = await prisma.sequence.upsert({
        where: { type },
        update: { counter: { increment: 1 } },
        create: { type, counter: 1 }
      });
      return sequence.counter;
    } catch (prismaError: any) {
      // If model doesn't exist yet, try raw SQL with correct column names
      console.warn(`[ID Generator] Prisma model failed, trying raw SQL for ${type}:`, prismaError.message);
      
      // Try raw SQL with snake_case column names (PostgreSQL default)
      try {
        const result = await prisma.$queryRaw`
          INSERT INTO sequences (type, counter, "updatedAt")
          VALUES (${type}::text, 1, NOW())
          ON CONFLICT (type) 
          DO UPDATE SET counter = sequences.counter + 1, "updatedAt" = NOW()
          RETURNING counter
        `;
        
        if (result && Array.isArray(result) && result[0]) {
          return Number(result[0].counter);
        }
      } catch (rawError: any) {
        console.warn(`[ID Generator] Raw SQL failed for ${type}:`, rawError.message);
      }
      
      // Fallback to timestamp-based
      return Math.floor(Date.now() / 1000) % 1000000;
    }
  } catch (error: any) {
    console.error(`[ID Generator] Error getting sequence for ${type}:`, error.message);
    // Fallback to timestamp-based
    return Math.floor(Date.now() / 1000) % 1000000;
  }
}

/**
 * Generate reference with database sequence
 */
export async function generateBookingReferenceAsync(): Promise<string> {
  const counter = await getNextSequence('booking');
  const padded = String(counter).padStart(6, '0');
  return `SPANA-BK-${padded}`;
}

export async function generatePaymentReferenceAsync(): Promise<string> {
  const counter = await getNextSequence('payment');
  const padded = String(counter).padStart(6, '0');
  return `SPANA-PY-${padded}`;
}

export async function generateUserReferenceAsync(): Promise<string> {
  const counter = await getNextSequence('user');
  const padded = String(counter).padStart(6, '0');
  return `SPN-USR-${padded}`;
}

export async function generateMessageReferenceAsync(): Promise<string> {
  const counter = await getNextSequence('message');
  const padded = String(counter).padStart(6, '0');
  return `SPN-MSG-${padded}`;
}

export async function generateServiceReferenceAsync(): Promise<string> {
  const counter = await getNextSequence('service');
  const padded = String(counter).padStart(6, '0');
  return `SPN-SVC-${padded}`;
}
