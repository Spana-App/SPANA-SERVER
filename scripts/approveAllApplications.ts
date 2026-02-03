/**
 * Approve All Pending Applications
 * 
 * This script will:
 * 1. Get all pending applications
 * 2. Approve each one (creates provider account)
 * 3. Links documents
 * 4. Sends registration emails
 * 5. Shows the flow for each application
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.PRODUCTION_URL || 'https://spana-server-5bhu.onrender.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.argv[2] || '';

async function approveAllApplications() {
  console.log('🚀 Approving All Pending Applications\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  if (!ADMIN_TOKEN) {
    console.error('❌ Admin token required!');
    console.log('Usage: ADMIN_TOKEN=<token> npx ts-node scripts/approveAllApplications.ts');
    console.log('   Or: npx ts-node scripts/approveAllApplications.ts <token>');
    process.exit(1);
  }

  try {
    // Step 1: Get all pending applications
    console.log('📋 Step 1: Fetching pending applications...');
    const response = await axios.get(
      `${BASE_URL}/admin/applications?status=pending`,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    const applications = response.data.applications;
    console.log(`✅ Found ${applications.length} pending application(s)\n`);

    if (applications.length === 0) {
      console.log('✨ No pending applications to approve!\n');
      return;
    }

    // Step 2: Approve each application
    for (let i = 0; i < applications.length; i++) {
      const application = applications[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📝 Application ${i + 1}/${applications.length}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Email: ${application.email}`);
      console.log(`Name: ${application.firstName} ${application.lastName}`);
      console.log(`Skills: ${application.skills.join(', ')}`);
      console.log(`Experience: ${application.experienceYears} years`);
      console.log(`Documents: ${application.documents ? application.documents.length : 0}`);
      
      if (application.documents && application.documents.length > 0) {
        console.log('\n📎 Documents:');
        application.documents.forEach((doc: any, idx: number) => {
          console.log(`   ${idx + 1}. ${doc.type.toUpperCase()}: ${doc.name}`);
          console.log(`      URL: ${BASE_URL}${doc.url}`);
        });
      }

      try {
        // Step 3: Verify and create provider account
        console.log(`\n✅ Step 2: Verifying application and creating provider account...`);
        const verifyResponse = await axios.post(
          `${BASE_URL}/admin/applications/${application.id}/verify`,
          {},
          {
            headers: {
              Authorization: `Bearer ${ADMIN_TOKEN}`
            }
          }
        );

        console.log('✅ Application approved successfully!');
        console.log(`   User ID: ${verifyResponse.data.user.id}`);
        console.log(`   Provider ID: ${verifyResponse.data.provider.id}`);
        console.log(`   Status: ${verifyResponse.data.application.status}`);

        // Step 4: Get provider details to show registration link
        const provider = await prisma.serviceProvider.findUnique({
          where: { id: verifyResponse.data.provider.id },
          include: {
            user: true
          }
        });

        if (provider && provider.verificationToken) {
          const registrationLink = `${BASE_URL}/complete-registration?token=${provider.verificationToken}&uid=${provider.userId}`;
          console.log(`\n📧 Registration Link:`);
          console.log(`   ${registrationLink}`);
          console.log(`\n🔐 Temporary Password: ${provider.temporaryPassword}`);
          console.log(`   (Will be sent via email after profile completion)`);
        }

        // Step 5: Check if documents were linked
        const documents = await prisma.document.findMany({
          where: { providerId: provider?.id }
        });

        if (documents.length > 0) {
          console.log(`\n📎 Documents Linked to Provider:`);
          documents.forEach((doc, idx) => {
            console.log(`   ${idx + 1}. ${doc.type} - ${doc.url}`);
            console.log(`      Verified: ${doc.verified ? 'Yes' : 'No (pending admin verification)'}`);
          });
        }

        // Step 6: Show verification flags
        console.log(`\n🏷️  Verification Flags:`);
        console.log(`   isEmailVerified: ${provider?.user.isEmailVerified} (will be true after credentials email)`);
        console.log(`   isPhoneVerified: ${provider?.user.isPhoneVerified}`);
        console.log(`   isIdentityVerified: ${provider?.isIdentityVerified} ✅`);
        console.log(`   isVerified: ${provider?.isVerified} ✅`);

        console.log(`\n✅ Flow completed for ${application.email}`);
        console.log(`   → Provider account created`);
        console.log(`   → Registration email sent`);
        console.log(`   → Provider can complete profile and receive credentials`);

      } catch (error: any) {
        console.error(`\n❌ Failed to approve application ${application.email}:`);
        if (error.response) {
          console.error(`   Status: ${error.response.status}`);
          console.error(`   Message: ${error.response.data?.message || JSON.stringify(error.response.data)}`);
        } else {
          console.error(`   Error: ${error.message}`);
        }
        console.log(`   Continuing with next application...\n`);
      }

      // Small delay between approvals
      if (i < applications.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 Completed processing ${applications.length} application(s)`);
    console.log(`${'='.repeat(60)}\n`);

    // Final summary
    const finalResponse = await axios.get(
      `${BASE_URL}/admin/applications`,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`
        }
      }
    );

    const finalApps = finalResponse.data.applications;
    const pending = finalApps.filter((a: any) => a.status === 'pending').length;
    const approved = finalApps.filter((a: any) => a.status === 'approved').length;
    const rejected = finalApps.filter((a: any) => a.status === 'rejected').length;

    console.log('📊 Final Status:');
    console.log(`   Pending: ${pending}`);
    console.log(`   Approved: ${approved}`);
    console.log(`   Rejected: ${rejected}`);
    console.log(`   Total: ${finalApps.length}\n`);

  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

approveAllApplications();
