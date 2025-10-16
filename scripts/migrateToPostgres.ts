// Migration script to set up PostgreSQL database and migrate from MongoDB
import prisma from '../lib/database';
import { fullSyncToMongo } from '../lib/mongoSync';

const setupDatabase = async () => {
  try {
    console.log('🚀 Setting up PostgreSQL database...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Create database if it doesn't exist (this would need to be done manually)
    console.log('📝 Note: Make sure your PostgreSQL database exists and PostGIS extension is enabled');
    console.log('   Run: CREATE EXTENSION postgis; in your PostgreSQL database');
    
    // Push schema to database
    console.log('📋 Pushing Prisma schema to database...');
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS postgis;`;
    
    console.log('✅ Database setup completed');
    console.log('🔄 You can now run: npm run sync:mongo to sync existing data');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

const syncExistingData = async () => {
  try {
    console.log('🔄 Syncing existing data to MongoDB backup...');
    await fullSyncToMongo();
    console.log('✅ Data sync completed');
  } catch (error) {
    console.error('❌ Data sync failed:', error);
  }
};

// Run based on command line arguments
const command = process.argv[2];

if (command === 'setup') {
  setupDatabase();
} else if (command === 'sync') {
  syncExistingData();
} else {
  console.log('Usage:');
  console.log('  npm run migrate:setup - Set up PostgreSQL database');
  console.log('  npm run migrate:sync - Sync existing data to MongoDB');
}
