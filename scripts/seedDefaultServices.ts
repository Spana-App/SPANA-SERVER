/**
 * Seed Default System Services
 * 
 * Creates default services that come with the system automatically.
 * These services are available to all users and can be assigned to providers later.
 * Admins can add more services on top of these defaults.
 */

import prisma from '../lib/database';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(step: string, message: string, color: string = colors.reset) {
  console.log(`${color}${step}${colors.reset} ${message}`);
}

// Default services that come with the system
const defaultServices = [
  {
    title: 'Emergency Plumbing',
    description: '24/7 emergency plumbing services for leaks, clogs, and urgent repairs. Fast response time guaranteed.',
    price: 450,
    duration: 120,
    mediaUrl: 'https://example.com/services/emergency-plumbing.jpg'
  },
  {
    title: 'Pipe Repair',
    description: 'Professional pipe repair and replacement services. Fix leaks, burst pipes, and damaged plumbing.',
    price: 350,
    duration: 90,
    mediaUrl: 'https://example.com/services/pipe-repair.jpg'
  },
  {
    title: 'Drain Cleaning',
    description: 'Expert drain cleaning and unclogging services. Clear blocked drains and prevent future issues.',
    price: 280,
    duration: 60,
    mediaUrl: 'https://example.com/services/drain-cleaning.jpg'
  },
  {
    title: 'Electrical Repair',
    description: 'Professional electrical repair services. Fix faulty wiring, outlets, switches, and electrical issues.',
    price: 400,
    duration: 90,
    mediaUrl: 'https://example.com/services/electrical-repair.jpg'
  },
  {
    title: 'Wiring Installation',
    description: 'Safe and professional wiring installation for homes and businesses. Code-compliant work guaranteed.',
    price: 550,
    duration: 180,
    mediaUrl: 'https://example.com/services/wiring-installation.jpg'
  },
  {
    title: 'Light Installation',
    description: 'Installation of lighting fixtures, chandeliers, and outdoor lighting. Professional and safe.',
    price: 300,
    duration: 75,
    mediaUrl: 'https://example.com/services/light-installation.jpg'
  },
  {
    title: 'House Cleaning',
    description: 'Comprehensive house cleaning services. Deep cleaning, regular maintenance, and move-in/out cleaning.',
    price: 450,
    duration: 180,
    mediaUrl: 'https://example.com/services/house-cleaning.jpg'
  },
  {
    title: 'Office Cleaning',
    description: 'Professional office cleaning services. Keep your workspace clean and productive.',
    price: 600,
    duration: 240,
    mediaUrl: 'https://example.com/services/office-cleaning.jpg'
  },
  {
    title: 'Deep Cleaning',
    description: 'Thorough deep cleaning service. Detailed cleaning of all areas including hard-to-reach places.',
    price: 750,
    duration: 300,
    mediaUrl: 'https://example.com/services/deep-cleaning.jpg'
  },
  {
    title: 'Furniture Repair',
    description: 'Expert furniture repair and restoration services. Fix broken chairs, tables, and wooden furniture.',
    price: 400,
    duration: 120,
    mediaUrl: 'https://example.com/services/furniture-repair.jpg'
  },
  {
    title: 'Cabinet Installation',
    description: 'Professional cabinet installation and repair. Kitchen, bathroom, and custom cabinets.',
    price: 650,
    duration: 240,
    mediaUrl: 'https://example.com/services/cabinet-installation.jpg'
  },
  {
    title: 'Door Repair',
    description: 'Door repair and installation services. Fix squeaky doors, broken locks, and damaged frames.',
    price: 350,
    duration: 90,
    mediaUrl: 'https://example.com/services/door-repair.jpg'
  },
  {
    title: 'Interior Painting',
    description: 'Professional interior painting services. Transform your home with quality paint work.',
    price: 500,
    duration: 240,
    mediaUrl: 'https://example.com/services/interior-painting.jpg'
  },
  {
    title: 'Exterior Painting',
    description: 'Exterior painting and weatherproofing. Protect and beautify your home exterior.',
    price: 800,
    duration: 360,
    mediaUrl: 'https://example.com/services/exterior-painting.jpg'
  },
  {
    title: 'Lawn Mowing',
    description: 'Regular lawn mowing and grass cutting services. Keep your lawn neat and well-maintained.',
    price: 250,
    duration: 90,
    mediaUrl: 'https://example.com/services/lawn-mowing.jpg'
  },
  {
    title: 'Garden Design',
    description: 'Professional garden design and landscaping services. Create beautiful outdoor spaces.',
    price: 1200,
    duration: 480,
    mediaUrl: 'https://example.com/services/garden-design.jpg'
  },
  {
    title: 'Tree Trimming',
    description: 'Safe tree trimming and pruning services. Maintain healthy trees and improve aesthetics.',
    price: 450,
    duration: 120,
    mediaUrl: 'https://example.com/services/tree-trimming.jpg'
  },
];

async function main() {
  try {
    log('🚀', 'Starting Default Services Seeding', colors.blue);
    console.log('');

    // Get or create an admin user for approval
    let admin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    if (!admin) {
      log('⚠️', 'No admin user found. Creating system admin for service approval...', colors.yellow);
      // Create a system admin (you can update this email later)
      admin = await prisma.user.create({
        data: {
          email: 'system@spana.co.za',
          password: '$2a$12$systemdefaultpasswordhash', // Should be changed
          firstName: 'System',
          lastName: 'Admin',
          phone: '+27123456789',
          role: 'admin',
          isEmailVerified: true
        }
      });
      log('✅', 'System admin created', colors.green);
    }

    log('📋', `Creating ${defaultServices.length} default system services...`, colors.blue);
    console.log('');

    let created = 0;
    let skipped = 0;

    for (const serviceData of defaultServices) {
      // Check if service already exists (by title)
      const existing = await prisma.service.findFirst({
        where: {
          title: serviceData.title,
          isSystemService: true
        }
      });

      if (existing) {
        log('⏭️', `Skipped: ${serviceData.title} (already exists)`, colors.yellow);
        skipped++;
        continue;
      }

      // Create default service (no provider assigned)
      const { category, ...serviceDataWithoutCategory } = serviceData as any;
      const service = await prisma.service.create({
        data: {
          ...serviceDataWithoutCategory,
          ...serviceDataWithoutCategory,
          providerId: null, // No provider assigned - admins can assign later
          status: 'active',
          adminApproved: true,
          isSystemService: true, // Mark as system service
          approvedBy: admin.id,
          approvedAt: new Date()
        }
      });

      created++;
      log('✅', `Created: ${serviceData.title}`, colors.green);
    }

    console.log('');
    log('📊', 'SEEDING SUMMARY', colors.blue);
    console.log('');
    console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
    console.log(`${colors.green}✅ Created:${colors.reset} ${created} default services`);
    console.log(`${colors.yellow}⏭️  Skipped:${colors.reset} ${skipped} (already exist)`);
    console.log(`${colors.blue}📦 Total Default Services:${colors.reset} ${await prisma.service.count({ where: { isSystemService: true } })}`);
    console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
    console.log('');

    log('🎉', 'Default Services Seeding Completed Successfully!', colors.green);
    log('💡', 'These services are now available system-wide. Admins can assign providers to them later.', colors.cyan);

  } catch (error) {
    console.error(colors.red + '❌ Error during seeding:' + colors.reset, error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('');
    log('✅', 'Seeding finished', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    console.error(colors.red + '❌ Seeding failed:' + colors.reset, error);
    process.exit(1);
  });

