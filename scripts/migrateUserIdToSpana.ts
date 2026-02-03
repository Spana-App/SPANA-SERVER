/**
 * Migration Script: Replace User IDs with SPANA Format
 * 
 * This script:
 * 1. Updates all user.id values from cuid() format to SPN-{random} format
 * 2. Updates all foreign key references (customers, service_providers, notifications, activities, sessions)
 * 3. Removes the referenceNumber column
 * 
 * IMPORTANT: This is a destructive migration. Backup your database first!
 */

import prisma from '../lib/database';
const crypto = require('crypto');

// Generate cryptographically secure random code
function generateSecureCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

// Generate SPANA ID
function generateSpanaId(): string {
  return `SPN-${generateSecureCode()}`;
}

async function migrateUserIdToSpana() {
  console.log('🚀 Starting User ID Migration to SPANA Format\n');
  console.log('⚠️  This will update all user IDs and foreign key references!\n');

  try {
    // Step 1: Get all users
    console.log('📝 Step 1: Fetching all users...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true
      }
    });
    console.log(`   Found ${users.length} users\n`);

    // Step 2: Create ID mapping (old ID -> new SPANA ID)
    console.log('📝 Step 2: Generating SPANA IDs...');
    const idMapping = new Map<string, string>();
    const usedIds = new Set<string>();

    for (const user of users) {
      let newId: string;
      let attempts = 0;
      do {
        newId = generateSpanaId();
        attempts++;
        if (attempts > 50) {
          // Fallback
          const timestamp = Date.now().toString(36).slice(-6);
          const random = crypto.randomBytes(2).toString('hex');
          newId = `SPN-${timestamp}${random}`;
          break;
        }
      } while (usedIds.has(newId));
      
      usedIds.add(newId);
      idMapping.set(user.id, newId);
    }
    console.log(`   Generated ${idMapping.size} SPANA IDs\n`);

    // Step 3: Disable foreign key constraints temporarily
    console.log('📝 Step 3: Preparing database...');
    await prisma.$executeRawUnsafe(`
      -- Disable foreign key constraints temporarily
      SET session_replication_role = 'replica';
    `);
    console.log('   Foreign key constraints disabled\n');

    // Step 4: Update all foreign key references first
    console.log('📝 Step 4: Updating foreign key references...');
    
    // Update customers table (batch update using CASE statement)
    const customerResult = await prisma.$executeRawUnsafe(`
      UPDATE customers 
      SET "userId" = CASE "userId"
        ${Array.from(idMapping.entries()).map(([oldId, newId]) => 
          `WHEN '${oldId}' THEN '${newId}'`
        ).join(' ')}
        ELSE "userId"
      END
      WHERE "userId" IN (${Array.from(idMapping.keys()).map(id => `'${id}'`).join(', ')})
    `);
    console.log(`   ✅ Updated customer references`);

    // Update service_providers table
    const providerResult = await prisma.$executeRawUnsafe(`
      UPDATE service_providers 
      SET "userId" = CASE "userId"
        ${Array.from(idMapping.entries()).map(([oldId, newId]) => 
          `WHEN '${oldId}' THEN '${newId}'`
        ).join(' ')}
        ELSE "userId"
      END
      WHERE "userId" IN (${Array.from(idMapping.keys()).map(id => `'${id}'`).join(', ')})
    `);
    console.log(`   ✅ Updated service provider references`);

    // Update notifications table
    const notificationResult = await prisma.$executeRawUnsafe(`
      UPDATE notifications 
      SET "userId" = CASE "userId"
        ${Array.from(idMapping.entries()).map(([oldId, newId]) => 
          `WHEN '${oldId}' THEN '${newId}'`
        ).join(' ')}
        ELSE "userId"
      END
      WHERE "userId" IN (${Array.from(idMapping.keys()).map(id => `'${id}'`).join(', ')})
    `);
    console.log(`   ✅ Updated notification references`);

    // Update activities table
    const activityResult = await prisma.$executeRawUnsafe(`
      UPDATE activities 
      SET "userId" = CASE "userId"
        ${Array.from(idMapping.entries()).map(([oldId, newId]) => 
          `WHEN '${oldId}' THEN '${newId}'`
        ).join(' ')}
        ELSE "userId"
      END
      WHERE "userId" IN (${Array.from(idMapping.keys()).map(id => `'${id}'`).join(', ')})
    `);
    console.log(`   ✅ Updated activity references`);

    // Update sessions table
    const sessionResult = await prisma.$executeRawUnsafe(`
      UPDATE sessions 
      SET "userId" = CASE "userId"
        ${Array.from(idMapping.entries()).map(([oldId, newId]) => 
          `WHEN '${oldId}' THEN '${newId}'`
        ).join(' ')}
        ELSE "userId"
      END
      WHERE "userId" IN (${Array.from(idMapping.keys()).map(id => `'${id}'`).join(', ')})
    `);
    console.log(`   ✅ Updated session references\n`);

    // Step 5: Update user IDs (batch update)
    console.log('📝 Step 5: Updating user IDs...');
    const userUpdateResult = await prisma.$executeRawUnsafe(`
      UPDATE users 
      SET id = CASE id
        ${Array.from(idMapping.entries()).map(([oldId, newId]) => 
          `WHEN '${oldId}' THEN '${newId}'`
        ).join(' ')}
        ELSE id
      END
      WHERE id IN (${Array.from(idMapping.keys()).map(id => `'${id}'`).join(', ')})
    `);
    console.log(`   ✅ Updated ${idMapping.size} user IDs\n`);

    // Step 6: Re-enable foreign key constraints
    console.log('📝 Step 6: Re-enabling foreign key constraints...');
    await prisma.$executeRawUnsafe(`
      SET session_replication_role = 'origin';
    `);
    console.log('   ✅ Foreign key constraints re-enabled\n');

    // Step 7: Remove referenceNumber column
    console.log('📝 Step 7: Removing referenceNumber column...');
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE users DROP COLUMN IF EXISTS "referenceNumber";
      `);
      console.log('   ✅ referenceNumber column removed\n');
    } catch (error: any) {
      console.log(`   ⚠️  Could not remove referenceNumber column: ${error.message}\n`);
    }

    // Summary
    console.log('='.repeat(60));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log(`Total users updated: ${idMapping.size}`);
    console.log('\n✨ All user IDs now use SPN-{random} format!');
    console.log('✨ referenceNumber column removed!');

    // Show sample results
    console.log('\n📊 Sample Users:');
    const sampleUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });
    sampleUsers.forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.firstName} ${user.lastName} - ${user.email}`);
      console.log(`      ID: ${user.id}`);
    });

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    
    // Try to re-enable constraints on error
    try {
      await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
    } catch (e) {
      console.error('Failed to re-enable constraints:', e);
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateUserIdToSpana();
