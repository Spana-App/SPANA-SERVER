/**
 * Cleanup Users (MongoDB - Legacy)
 * ⚠️  WARNING: This script modifies user data!
 * 
 * ⚠️  SAFETY: This script requires explicit admin confirmation via environment variable.
 * To run this script, you MUST set: ALLOW_CLEANUP=true
 * 
 * Example: ALLOW_CLEANUP=true node scripts/cleanupUsers.js
 * 
 * Policy: All data modifications must be manual and intentional.
 * Automatic cleanup is NOT allowed.
 */

// Usage: node scripts/cleanupUsers.js
require('dotenv').config();

// SAFETY CHECK: Require explicit admin confirmation
if (process.env.ALLOW_CLEANUP !== 'true') {
  console.error('\n❌ CLEANUP BLOCKED: Automatic cleanup is disabled!\n');
  console.error('⚠️  This script modifies user data.');
  console.error('⚠️  To prevent accidental data loss, this script requires explicit confirmation.\n');
  console.error('📋 To run this script manually (admin only):');
  console.error('   Set environment variable: ALLOW_CLEANUP=true');
  console.error('   Example: ALLOW_CLEANUP=true node scripts/cleanupUsers.js\n');
  console.error('🔒 Policy: All data modifications must be manual and intentional.');
  console.error('   Automatic cleanup is NOT allowed.\n');
  process.exit(1);
}

const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  console.log('\n⚠️  WARNING: This script will modify user data!');
  console.log('⚠️  You have explicitly enabled cleanup with ALLOW_CLEANUP=true\n');
  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const users = await User.find();
  let cleaned = 0;
  for (const user of users) {
    let changed = false;
    if (user.role === 'customer') {
      const toDelete = ['skills','rating','totalReviews','documents','availability','serviceArea','experienceYears','isOnline'];
      for (const k of toDelete) if (user[k] !== undefined) { user.set(k, undefined); changed = true; }
      // ensure customerDetails exists
      if (!user.customerDetails) { user.customerDetails = { favouriteProviders: [], totalBookings: 0, ratingGivenAvg: 0 }; changed = true; }
    } else if (user.role === 'service provider') {
      // remove customer-only fields
      if (user.customerDetails !== undefined) { user.set('customerDetails', undefined); changed = true; }
    } else {
      // admin/system: remove provider/customer specific fields
      const toDelete = ['skills','rating','totalReviews','documents','availability','serviceArea','experienceYears','isOnline','customerDetails'];
      for (const k of toDelete) if (user[k] !== undefined) { user.set(k, undefined); changed = true; }
    }
    if (changed) { await user.save(); cleaned++; }
  }
  console.log(`Cleanup complete. Updated ${cleaned} users.`);
  await mongoose.connection.close();
}

run().catch(err => { console.error(err); process.exit(1); });

export {};


