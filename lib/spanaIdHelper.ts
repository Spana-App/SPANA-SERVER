/**
 * SPANA ID Helper
 * Utilities for working with SPANA IDs and mapping between internal IDs and SPANA IDs
 */

import prisma from './database';

/**
 * Find user by SPANA ID
 */
export async function findUserBySpanaId(spanaId: string) {
  return prisma.user.findFirst({
    where: {
      id: spanaId
    }
  });
}

/**
 * Find booking by SPANA ID
 */
export async function findBookingBySpanaId(spanaId: string) {
  return prisma.booking.findFirst({
    where: {
      id: spanaId
    }
  });
}

/**
 * Find payment by SPANA ID
 */
export async function findPaymentBySpanaId(spanaId: string) {
  return prisma.payment.findFirst({
    where: {
      id: spanaId
    }
  });
}

/**
 * Transform user object to use SPANA ID as primary identifier
 */
export function transformUserResponse(user: any) {
  if (!user) return null;
  
  return {
    ...user,
    id: user.id // ID is already SPANA format
  };
}

/**
 * Transform booking object to use SPANA ID as primary identifier
 */
export function transformBookingResponse(booking: any) {
  if (!booking) return null;
  
  return {
    ...booking,
    id: booking.id // ID is already SPANA format (or will be)
  };
}

/**
 * Transform payment object to use SPANA ID as primary identifier
 */
export function transformPaymentResponse(payment: any) {
  if (!payment) return null;
  
  return {
    ...payment,
    id: payment.id // ID is already SPANA format (or will be)
  };
}

/**
 * Transform array of users
 */
export function transformUsersResponse(users: any[]) {
  return users.map(transformUserResponse);
}

/**
 * Transform array of bookings
 */
export function transformBookingsResponse(bookings: any[]) {
  return bookings.map(transformBookingResponse);
}

/**
 * Transform array of payments
 */
export function transformPaymentsResponse(payments: any[]) {
  return payments.map(transformPaymentResponse);
}
