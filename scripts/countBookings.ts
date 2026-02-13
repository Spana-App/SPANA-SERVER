/**
 * Count Bookings in Database
 * Can be run with admin token or directly query database
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_BASE_URL = process.env.API_BASE_URL || 'https://spana-server-5bhu.onrender.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // Set this if you want to test via API
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'xoli@spana.co.za';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function countViaDatabase() {
  try {
    log('\n📊 Counting Bookings via Database\n', colors.blue);

    // Total count
    const totalCount = await prisma.booking.count();
    log(`✅ Total Bookings: ${totalCount}`, colors.green);

    // Count by status
    const statusCounts = await prisma.booking.groupBy({
      by: ['status'],
      _count: true
    });

    log('\n📈 Bookings by Status:', colors.yellow);
    statusCounts.forEach(({ status, _count }) => {
      log(`   ${status}: ${_count}`, colors.cyan);
    });

    // Count by payment status
    const paymentStatusCounts = await prisma.booking.groupBy({
      by: ['paymentStatus'],
      _count: true
    });

    log('\n💰 Bookings by Payment Status:', colors.yellow);
    paymentStatusCounts.forEach(({ paymentStatus, _count }) => {
      log(`   ${paymentStatus}: ${_count}`, colors.cyan);
    });

    // Count by request status
    const requestStatusCounts = await prisma.booking.groupBy({
      by: ['requestStatus'],
      _count: true
    });

    log('\n📋 Bookings by Request Status:', colors.yellow);
    requestStatusCounts.forEach(({ requestStatus, _count }) => {
      log(`   ${requestStatus}: ${_count}`, colors.cyan);
    });

    // Recent bookings (last 10)
    const recentBookings = await prisma.booking.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        paymentStatus: true,
        requestStatus: true,
        createdAt: true
      }
    });

    log('\n🕐 Recent Bookings (Last 10):', colors.yellow);
    recentBookings.forEach((booking, index) => {
      log(`   ${index + 1}. ${booking.referenceNumber || booking.id} - ${booking.status} (${booking.paymentStatus}) - ${booking.createdAt.toISOString().split('T')[0]}`, colors.cyan);
    });

    return totalCount;
  } catch (error: any) {
    log(`\n❌ Database Error: ${error.message}`, colors.red);
    throw error;
  }
}

async function loginAsAdmin(): Promise<string | null> {
  try {
    if (ADMIN_TOKEN) {
      return ADMIN_TOKEN;
    }

    if (!ADMIN_PASSWORD) {
      return null;
    }

    log('   🔐 Logging in as admin...', colors.yellow);
    const loginResponse = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      { timeout: 30000, validateStatus: () => true }
    );

    if (loginResponse.status === 200 && loginResponse.data.requiresOTP) {
      const otp = loginResponse.data.otp;
      log(`   📧 OTP received: ${otp}`, colors.cyan);
      
      const verifyResponse = await axios.post(
        `${API_BASE_URL}/admin/otp/verify`,
        { email: ADMIN_EMAIL, otp: otp },
        { timeout: 30000, validateStatus: () => true }
      );

      if (verifyResponse.status === 200 && verifyResponse.data.token) {
        log('   ✅ OTP verified!', colors.green);
        return verifyResponse.data.token;
      }
    } else if (loginResponse.data.token) {
      log('   ✅ Login successful!', colors.green);
      return loginResponse.data.token;
    }

    return null;
  } catch (error: any) {
    log(`   ❌ Login error: ${error.message}`, colors.red);
    return null;
  }
}

async function countViaAPI() {
  try {
    log('\n📊 Counting Bookings via API (Hosted Server)\n', colors.blue);
    log(`📍 API Base URL: ${API_BASE_URL}`, colors.cyan);

    const token = await loginAsAdmin();
    if (!token) {
      log('\n⚠️  Could not get admin token. Set ADMIN_TOKEN or ADMIN_PASSWORD env vars', colors.yellow);
      return null;
    }

    const response = await axios.get(`${API_BASE_URL}/admin/bookings`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 15000
    });

    const bookings = response.data;
    const count = Array.isArray(bookings) ? bookings.length : 0;

    log(`\n✅ Total Bookings (via API): ${count}`, colors.green);

    // Show breakdown if we have bookings
    if (count > 0 && Array.isArray(bookings)) {
      const statusCounts: Record<string, number> = {};
      const paymentStatusCounts: Record<string, number> = {};
      
      bookings.forEach((booking: any) => {
        statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
        paymentStatusCounts[booking.paymentStatus] = (paymentStatusCounts[booking.paymentStatus] || 0) + 1;
      });

      log('\n📈 Breakdown by Status:', colors.yellow);
      Object.entries(statusCounts).forEach(([status, count]) => {
        log(`   ${status}: ${count}`, colors.cyan);
      });

      log('\n💰 Breakdown by Payment Status:', colors.yellow);
      Object.entries(paymentStatusCounts).forEach(([status, count]) => {
        log(`   ${status}: ${count}`, colors.cyan);
      });
    }

    return count;
  } catch (error: any) {
    if (error.response) {
      log(`\n❌ API Error: ${error.response.status} - ${error.response.data?.message || 'Unauthorized'}`, colors.red);
    } else {
      log(`\n❌ API Error: ${error.message}`, colors.red);
    }
    return null;
  }
}

async function main() {
  try {
    // Try database first (most reliable)
    const dbCount = await countViaDatabase();

    // Try API if token is provided
    const apiCount = await countViaAPI();

    if (apiCount !== null && dbCount !== apiCount) {
      log(`\n⚠️  Count mismatch: Database=${dbCount}, API=${apiCount}`, colors.yellow);
    }

    log('\n' + '='.repeat(60), colors.blue);
    log(`✅ Total Bookings: ${dbCount}`, colors.green);
    log('='.repeat(60) + '\n', colors.blue);

  } catch (error: any) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
