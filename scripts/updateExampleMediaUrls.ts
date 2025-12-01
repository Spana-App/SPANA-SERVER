/**
 * Update placeholder mediaUrl values in the database to use real image URLs.
 *
 * This script:
 *  - Finds all services where mediaUrl starts with 'https://example.com' or is empty
 *  - Maps each service title to a relevant Unsplash Source URL
 *  - Updates the records in-place
 *
 * NOTE:
 *  - This works against whatever DATABASE_URL is configured (Render external DB in your case).
 *  - Run with: npx ts-node scripts/updateExampleMediaUrls.ts
 */

import prisma from '../lib/database';

function getMediaUrlForServiceTitle(title: string | null | undefined): string {
  const t = (title || '').toLowerCase();

  if (t.includes('plumb')) {
    return 'https://source.unsplash.com/featured/?plumber,plumbing,repair';
  }
  if (t.includes('drain')) {
    return 'https://source.unsplash.com/featured/?plumber,drain,cleaning,clog';
  }
  if (t.includes('electric') || t.includes('wiring') || t.includes('panel')) {
    return 'https://source.unsplash.com/featured/?electrician,electrical,repair';
  }
  if (t.includes('light')) {
    return 'https://source.unsplash.com/featured/?electrician,lighting,installation';
  }
  if (t.includes('clean')) {
    if (t.includes('office')) {
      return 'https://source.unsplash.com/featured/?office,cleaning,janitor';
    }
    if (t.includes('deep')) {
      return 'https://source.unsplash.com/featured/?deep,cleaning,house';
    }
    return 'https://source.unsplash.com/featured/?house,cleaning,maid,interior';
  }
  if (t.includes('furniture') || t.includes('cabinet') || t.includes('door') || t.includes('carpentry')) {
    return 'https://source.unsplash.com/featured/?carpenter,woodworking,furniture,repair';
  }
  if (t.includes('paint')) {
    if (t.includes('exterior')) {
      return 'https://source.unsplash.com/featured/?exterior,painting,house,facade';
    }
    return 'https://source.unsplash.com/featured/?interior,painting,painter,home';
  }
  if (t.includes('lawn') || t.includes('mow')) {
    return 'https://source.unsplash.com/featured/?lawn,mowing,gardener,grass';
  }
  if (t.includes('garden') || t.includes('landscap') || t.includes('tree')) {
    return 'https://source.unsplash.com/featured/?garden,design,landscaping';
  }

  // Generic fallback for any other type of service
  return 'https://source.unsplash.com/featured/?handyman,home,service';
}

async function main() {
  console.log('🔍 Looking for services with placeholder mediaUrl (https://example.com or empty)...');

  const services = await prisma.service.findMany({
    where: {
      OR: [
        { mediaUrl: { startsWith: 'https://example.com' } },
        { mediaUrl: '' as any },
        { mediaUrl: null as any },
      ],
    },
  });

  if (!services.length) {
    console.log('✅ No services with placeholder mediaUrl found. Nothing to update.');
    return;
  }

  console.log(`⚙️  Found ${services.length} services to update.`);

  for (const service of services) {
    const newUrl = getMediaUrlForServiceTitle(service.title);

    console.log(`↻ Updating service "${service.title}" (${service.id})`);
    console.log(`   Old: ${service.mediaUrl}`);
    console.log(`   New: ${newUrl}`);

    await prisma.service.update({
      where: { id: service.id },
      data: { mediaUrl: newUrl },
    });
  }

  console.log('✅ Finished updating service mediaUrl values to real images.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Error while updating mediaUrl values:', err);
    await prisma.$disconnect();
    process.exit(1);
  });


