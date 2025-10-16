const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnvironment() {
  console.log('🔧 Spana Backend Environment Setup\n');
  console.log('This script will help you create a .env file with the necessary configuration.\n');

  // Check if .env already exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log('❌ Setup cancelled.');
      rl.close();
      return;
    }
  }

  console.log('\n📧 SMTP Configuration (for KonsoleH custom domain):');
  console.log('You can find these settings in your KonsoleH control panel under Email settings.\n');

  const smtpHost = await question('SMTP Host (e.g., mail.yourdomain.com): ');
  const smtpPort = await question('SMTP Port (587 for STARTTLS, 465 for SSL): ') || '587';
  const smtpUser = await question('SMTP Username (your email address): ');
  const smtpPass = await question('SMTP Password: ');
  const smtpFrom = await question('From Email Address (e.g., noreply@yourdomain.com): ') || smtpUser;

  console.log('\n🔐 JWT Configuration:');
  const jwtSecret = await question('JWT Secret (leave empty for auto-generated): ') || 
    require('crypto').randomBytes(64).toString('hex');

  console.log('\n🌐 Server Configuration:');
  const port = await question('Server Port (default: 5003): ') || '5003';
  const clientUrl = await question('Client URL (default: http://localhost:5003): ') || 'http://localhost:5003';

  // Create .env content
  const envContent = `# Database Configuration
DATABASE_URL="postgresql://postgres:EksIsHands0me@localhost:5432/spana_db"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=EksIsHands0me
POSTGRES_DB=spana_db
POSTGRES_SSL=false

# MongoDB (Backup/Sync)
MONGODB_URI=mongodb://localhost:27017/spana_backup

# JWT Configuration
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=${port}
NODE_ENV=development
CLIENT_URL=${clientUrl}

# Redis Configuration (Optional)
USE_REDIS=false
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# SMTP Configuration for KonsoleH Custom Domain
SMTP_HOST=${smtpHost}
SMTP_PORT=${smtpPort}
SMTP_USER=${smtpUser}
SMTP_PASS=${smtpPass}
SMTP_FROM=${smtpFrom}
SMTP_SECURE=${smtpPort === '465'}
SMTP_POOL=true
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
SMTP_CONNECTION_TIMEOUT=10000
SMTP_TLS_CIPHERS=TLSv1.2
SMTP_REJECT_UNAUTHORIZED=true

# Mail Provider Configuration
MAIL_PROVIDER=smtp
MAIL_ENABLED=true

# External API (Optional)
EXTERNAL_API_URL=

# App Version
APP_VERSION=1.0.0
`;

  // Write .env file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ .env file created successfully!');
    console.log(`📁 Location: ${envPath}`);
    
    console.log('\n🧪 Next steps:');
    console.log('1. Test your SMTP configuration: npx ts-node scripts/testSmtp.ts');
    console.log('2. Start the server: npm run dev');
    console.log('3. Test registration to verify email sending works');
    
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }

  rl.close();
}

setupEnvironment().catch(console.error);
