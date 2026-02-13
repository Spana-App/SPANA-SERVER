/**
 * Assigns services to Oscar so he can receive booking requests.
 * Providers only get matched when they have services that match the customer's request.
 * Run: npx ts-node scripts/assignServicesToOscar.ts
 */

import prisma from '../lib/database';

async function assignServicesToOscar() {
  try {
    console.log('🔧 Assigning services to Oscar for booking requests...\n');

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'okpoko15@gmail.com' },
          { email: 'okpoco15@gmail.com' },
          { firstName: { contains: 'oscar', mode: 'insensitive' } }
        ],
        role: 'service_provider'
      },
      include: { serviceProvider: { include: { services: true } } }
    });

    if (!user?.serviceProvider) {
      console.error('❌ Oscar (service provider) not found. Run completeOscarProfile first.');
      process.exit(1);
    }

    const provider = user.serviceProvider;
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });

    // Services to create for Oscar (match his skills: Plumbing, Electrical)
    const servicesToCreate = [
      { title: 'Emergency Plumbing', description: '24/7 emergency plumbing - leaks, clogs, urgent repairs.', price: 450, duration: 120, category: 'plumbing-electrical' },
      { title: 'Electrical Repair', description: 'Professional electrical repair - wiring, outlets, switches.', price: 400, duration: 90, category: 'plumbing-electrical' },
      { title: 'Pipe Repair', description: 'Pipe repair and replacement. Fix leaks and burst pipes.', price: 350, duration: 90, category: 'plumbing-electrical' }
    ];

    let created = 0;
    for (const svc of servicesToCreate) {
      const existing = await prisma.service.findFirst({
        where: { title: svc.title, providerId: provider.id }
      });
      if (existing) {
        console.log(`   ⏭️  ${svc.title} already exists for Oscar`);
        continue;
      }
      await prisma.service.create({
        data: {
          title: svc.title,
          description: svc.description,
          price: svc.price,
          duration: svc.duration,
          category: svc.category,
          providerId: provider.id,
          status: 'active',
          adminApproved: true,
          approvedBy: admin?.id,
          approvedAt: new Date(),
          isSystemService: false
        }
      });
      created++;
      console.log(`   ✅ Created: ${svc.title}`);
    }

    // Ensure Oscar is online
    await prisma.serviceProvider.update({
      where: { id: provider.id },
      data: { isOnline: true }
    });
    console.log('   ✅ Oscar set to online');

    console.log(`\n✅ Done. Oscar now has ${provider.services.length + created} service(s) and can receive booking requests.`);
    console.log('\n📋 Oscar will be matched when customers book: Emergency Plumbing, Electrical Repair, Pipe Repair');
    console.log('   (Customer location must be within 25km of Johannesburg coordinates)');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

assignServicesToOscar();
