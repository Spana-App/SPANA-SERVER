/**
 * Diagnose Why Bookings Table is Empty
 * Checks database connection, schema, and recent activity
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function diagnose() {
  try {
    log('\n🔍 DIAGNOSING EMPTY BOOKINGS TABLE\n', colors.blue);
    log('='.repeat(60), colors.blue);

    // 1. Check database connection
    log('\n1️⃣  Checking Database Connection...', colors.yellow);
    try {
      await prisma.$queryRaw`SELECT 1`;
      log('   ✅ Database connection successful', colors.green);
      
      // Get database info
      const dbInfo = await prisma.$queryRaw<Array<{ current_database: string }>>`
        SELECT current_database();
      `;
      log(`   📊 Database: ${dbInfo[0]?.current_database || 'unknown'}`, colors.cyan);
    } catch (error: any) {
      log(`   ❌ Database connection failed: ${error.message}`, colors.red);
      await prisma.$disconnect();
      return;
    }

    // 2. Check if bookings table exists
    log('\n2️⃣  Checking Bookings Table...', colors.yellow);
    try {
      const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'bookings'
        );
      `;
      
      if (tableExists[0]?.exists) {
        log('   ✅ Bookings table exists', colors.green);
      } else {
        log('   ❌ Bookings table does NOT exist!', colors.red);
        log('   💡 Run: npx prisma migrate deploy', colors.yellow);
        await prisma.$disconnect();
        return;
      }
    } catch (error: any) {
      log(`   ⚠️  Could not check table existence: ${error.message}`, colors.yellow);
    }

    // 3. Count bookings
    log('\n3️⃣  Counting Bookings...', colors.yellow);
    const bookingCount = await prisma.booking.count();
    log(`   📊 Total Bookings: ${bookingCount}`, colors.cyan);

    if (bookingCount === 0) {
      log('   ⚠️  Table is empty', colors.yellow);
    } else {
      log('   ✅ Bookings found!', colors.green);
    }

    // 4. Check related tables (customers, services)
    log('\n4️⃣  Checking Prerequisites...', colors.yellow);
    
    const customerCount = await prisma.customer.count();
    const serviceCount = await prisma.service.count();
    const userCount = await prisma.user.count();
    
    log(`   👥 Users: ${userCount}`, colors.cyan);
    log(`   🛒 Customers: ${customerCount}`, colors.cyan);
    log(`   🔧 Services: ${serviceCount}`, colors.cyan);

    if (customerCount === 0) {
      log('   ⚠️  No customers found - bookings require customers', colors.yellow);
    }
    if (serviceCount === 0) {
      log('   ⚠️  No services found - bookings require services', colors.yellow);
    }

    // 5. Check recent activity (activities table)
    log('\n5️⃣  Checking Recent Activity...', colors.yellow);
    try {
      const recentActivities = await prisma.activity.findMany({
        where: {
          actionType: {
            in: ['booking_request_created', 'booking_update', 'payment_confirm']
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      if (recentActivities.length > 0) {
        log(`   📋 Found ${recentActivities.length} recent booking-related activities:`, colors.cyan);
        recentActivities.forEach((activity, i) => {
          log(`      ${i + 1}. ${activity.actionType} - ${activity.createdAt.toISOString()}`, colors.cyan);
        });
      } else {
        log('   ⚠️  No recent booking activities found', colors.yellow);
      }
    } catch (error: any) {
      log(`   ⚠️  Could not check activities: ${error.message}`, colors.yellow);
    }

    // 6. Check for any database errors or constraints
    log('\n6️⃣  Checking Database Schema...', colors.yellow);
    try {
      const columns = await prisma.$queryRaw<Array<{ column_name: string, data_type: string }>>`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'bookings'
        ORDER BY ordinal_position
        LIMIT 10;
      `;
      
      if (columns.length > 0) {
        log(`   ✅ Found ${columns.length} columns in bookings table`, colors.green);
        log('   📋 Sample columns:', colors.cyan);
        columns.slice(0, 5).forEach(col => {
          log(`      - ${col.column_name} (${col.data_type})`, colors.cyan);
        });
      }
    } catch (error: any) {
      log(`   ⚠️  Could not check schema: ${error.message}`, colors.yellow);
    }

    // 7. Check DATABASE_URL
    log('\n7️⃣  Database Connection Info...', colors.yellow);
    const dbUrl = process.env.DATABASE_URL || 'Not set';
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
    log(`   🔗 DATABASE_URL: ${maskedUrl}`, colors.cyan);
    
    if (dbUrl.includes('supabase')) {
      log('   📍 Connected to: Supabase PostgreSQL', colors.cyan);
    } else if (dbUrl.includes('render.com')) {
      log('   📍 Connected to: Render PostgreSQL', colors.cyan);
    } else if (dbUrl.includes('localhost')) {
      log('   📍 Connected to: Local PostgreSQL', colors.cyan);
    } else {
      log('   📍 Connected to: Unknown provider', colors.yellow);
    }

    // 8. Summary and recommendations
    log('\n' + '='.repeat(60), colors.blue);
    log('📋 SUMMARY & RECOMMENDATIONS', colors.magenta);
    log('='.repeat(60), colors.blue);

    if (bookingCount === 0) {
      log('\n💡 Why the table might be empty:', colors.yellow);
      log('   1. No bookings have been created yet', colors.cyan);
      log('   2. Bookings were created but then deleted/cleaned up', colors.cyan);
      log('   3. You\'re connected to a different database than where bookings are created', colors.cyan);
      log('   4. Database migrations haven\'t been run', colors.cyan);
      
      log('\n🔧 To create test bookings:', colors.yellow);
      log('   • Run: npm run seed (if seed script exists)', colors.cyan);
      log('   • Or: Create a booking via POST /bookings API endpoint', colors.cyan);
      log('   • Or: Use test scripts like testHostedBooking.ts', colors.cyan);
      
      if (customerCount === 0 || serviceCount === 0) {
        log('\n⚠️  WARNING:', colors.red);
        if (customerCount === 0) {
          log('   • No customers exist - create customers first', colors.red);
        }
        if (serviceCount === 0) {
          log('   • No services exist - create services first', colors.red);
        }
        log('   • Bookings require both customers and services', colors.red);
      }
    } else {
      log(`\n✅ Found ${bookingCount} bookings in database!`, colors.green);
    }

    log('\n' + '='.repeat(60) + '\n', colors.blue);

  } catch (error: any) {
    log(`\n❌ Error during diagnosis: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
