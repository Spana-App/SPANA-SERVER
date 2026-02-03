import prisma from '../lib/database';

// Complete registration page - renders HTML form for provider profile completion
exports.completeRegistration = async (req: any, res: any) => {
  try {
    const { token, uid, success } = req.query;

    // Handle success page (after form submission)
    if (success === 'true') {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registration Complete</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              background: #F5F5F5;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              padding: 40px;
              text-align: center;
            }
            .success-icon {
              color: #28a745;
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #0066CC;
              font-size: 32px;
              margin-bottom: 15px;
            }
            p {
              color: #666;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Registration Complete!</h1>
            <p>Your profile has been set up successfully. You can now log into the SPANA app to start receiving bookings.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!token || !uid) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Missing Parameters</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #F5F5F5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #0066CC; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Missing Parameters</h1>
            <p>Please provide both token and uid in the verification link.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Find user and service provider with matching token
    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: {
        serviceProvider: true
      }
    });

    if (!user || user.role !== 'service_provider') {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Provider Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #F5F5F5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #0066CC; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Provider Not Found</h1>
            <p>The provider account could not be found.</p>
          </div>
        </body>
        </html>
      `);
    }

    const provider = user.serviceProvider;
    if (!provider) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Provider Record Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #F5F5F5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #0066CC; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Provider Record Not Found</h1>
            <p>The provider record could not be found.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Validate token
    if (!provider.verificationToken || provider.verificationToken !== token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Token</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #F5F5F5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #0066CC; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Invalid Token</h1>
            <p>The verification token is invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    // LAZY EXPIRATION: Token never expires if unused
    // 30-minute countdown starts on first use
    const now = new Date();
    let updatedProvider = provider;

    if (!provider.verificationTokenFirstUsedAt) {
      // First time using the token - mark it as "first used" NOW
      // This starts the 30-minute countdown
      updatedProvider = await prisma.serviceProvider.update({
        where: { userId: uid },
        data: {
          verificationTokenFirstUsedAt: now
        }
      });
    } else {
      // Token has been used before - check if it's expired (30 minutes from first use)
      const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutes
      const expiresAt = new Date(
        provider.verificationTokenFirstUsedAt.getTime() + thirtyMinutesInMs
      );

      if (now > expiresAt) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Token Expired</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #F5F5F5; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #0066CC; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Token Expired</h1>
              <p>The verification link has expired. The token expires 30 minutes after first use. Please request a new one.</p>
            </div>
          </body>
          </html>
        `);
      }
    }

    // Render profile completion form
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Complete Your SPANA Profile</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #F5F5F5;
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: #0066CC;
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
          }
          .content {
            padding: 40px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
          }
          input[type="text"],
          input[type="number"],
          textarea,
          select {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            font-family: inherit;
          }
          textarea {
            resize: vertical;
            min-height: 100px;
          }
          .skills-input {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .skill-tag {
            background: #0066CC;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          .skill-tag button {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            padding: 0;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .add-skill {
            display: flex;
            gap: 10px;
          }
          .add-skill input {
            flex: 1;
          }
          .btn {
            background: #0066CC;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
          }
          .btn:hover {
            background: #0052a3;
          }
          .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
          .message {
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            display: none;
          }
          .message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .message.show {
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to SPANA!</h1>
            <p>Complete your profile to start receiving bookings</p>
          </div>
          <div class="content">
            <div id="message" class="message"></div>
            <form id="profileForm">
              <div class="form-group">
                <label>First Name</label>
                <input type="text" name="firstName" value="${user.firstName || ''}" required>
              </div>
              <div class="form-group">
                <label>Last Name</label>
                <input type="text" name="lastName" value="${user.lastName || ''}" required>
              </div>
              <div class="form-group">
                <label>Phone Number</label>
                <input type="text" name="phone" value="${user.phone || ''}" required>
              </div>
              <div class="form-group">
                <label>Years of Experience</label>
                <input type="number" name="experienceYears" value="${updatedProvider.experienceYears || 0}" min="0" required>
              </div>
              <div class="form-group">
                <label>Skills (Add your service skills)</label>
                <div id="skillsContainer" class="skills-input">
                  ${(updatedProvider.skills || []).map((skill: string) => `
                    <span class="skill-tag" data-skill="${skill}">
                      ${skill}
                      <button type="button" class="remove-skill-btn" aria-label="Remove skill">×</button>
                    </span>
                  `).join('')}
                </div>
                <div class="add-skill" style="margin-top: 10px;">
                  <input type="text" id="newSkill" placeholder="Add a skill and press Enter">
                  <button type="button" id="addSkillButton" style="background: #0066CC; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer;">Add</button>
                </div>
              </div>
              <p style="color: #666; font-size: 14px; margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
                <strong>Next Steps:</strong> After completing your profile, you'll be able to log into the SPANA app dashboard where you can upload verification documents (ID, license, certifications) for review.
              </p>
              <input type="hidden" name="token" id="tokenInput" value="${token}">
              <input type="hidden" name="uid" id="uidInput" value="${uid}">
              <button type="submit" class="btn">Complete Profile</button>
            </form>
          </div>
        </div>
        <script src="/complete-registration.js?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}"></script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Server Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #F5F5F5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #0066CC; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Server Error</h1>
          <p>An error occurred while processing your request. Please try again later.</p>
        </div>
      </body>
      </html>
    `);
  }
};

// External script for complete registration (CSP-friendly, no inline JS)
// NOTE: This endpoint ALWAYS serves JavaScript - no token validation here.
// Token validation happens in:
// 1. GET /complete-registration (HTML page) - shows error messages
// 2. POST /complete-registration (form submission) - processes the form
exports.completeRegistrationScript = async (req: any, res: any) => {
  try {
    // Always serve the script - no validation needed here
    // The script reads token/uid from URL params and form fields
    const initialSkillsJson = JSON.stringify([]); // Start with empty skills array

    const script = `
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  const uidFromUrl = urlParams.get('uid');

  const tokenInput = document.getElementById('tokenInput');
  const uidInput = document.getElementById('uidInput');

  if (tokenFromUrl && tokenInput) {
    tokenInput.value = tokenFromUrl;
  }
  if (uidFromUrl && uidInput) {
    uidInput.value = uidFromUrl;
  }

  // Initialize skills from existing skill tags on the page (if any)
  let skills = ${initialSkillsJson};
  const skillsContainer = document.getElementById('skillsContainer');
  if (skillsContainer) {
    const existingTags = skillsContainer.querySelectorAll('.skill-tag[data-skill]');
    skills = Array.from(existingTags).map(function(tag) {
      return tag.getAttribute('data-skill') || '';
    }).filter(function(s) { return s; });
  }

  const newSkillInput = document.getElementById('newSkill');
  const addSkillButton = document.getElementById('addSkillButton');
  const form = document.getElementById('profileForm');
  const messageEl = document.getElementById('message');

  function renderSkills() {
    if (!skillsContainer) return;
    skillsContainer.innerHTML = skills
      .map(function(skill) {
        return '<span class="skill-tag" data-skill="' + skill + '">' +
                 skill +
                 '<button type="button" class="remove-skill-btn" aria-label="Remove skill">×</button>' +
               '</span>';
      })
      .join('');
  }

  function showMessage(type, text) {
    if (!messageEl) return;
    messageEl.classList.remove('show', 'success', 'error');
    if (type === 'success') {
      messageEl.classList.add('show', 'success');
    } else if (type === 'error') {
      messageEl.classList.add('show', 'error');
    }
    messageEl.textContent = text;
  }

  function addSkillFromInput() {
    if (!newSkillInput) return;
    var skill = newSkillInput.value.trim();
    if (skill && skills.indexOf(skill) === -1) {
      skills.push(skill);
      renderSkills();
      newSkillInput.value = '';
    }
  }

  if (addSkillButton) {
    addSkillButton.addEventListener('click', function() {
      addSkillFromInput();
    });
  }

  if (newSkillInput) {
    newSkillInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSkillFromInput();
      }
    });
  }

  if (skillsContainer) {
    skillsContainer.addEventListener('click', function(e) {
      var target = e.target;
      if (target && target.classList && target.classList.contains('remove-skill-btn')) {
        var tag = target.closest('.skill-tag');
        if (!tag) return;
        var skill = tag.getAttribute('data-skill');
        if (!skill) return;
        skills = skills.filter(function(s) { return s !== skill; });
        renderSkills();
      }
    });
  }

  renderSkills();

  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var formData = new FormData(form);
      var firstName = (formData.get('firstName') || '').toString().trim();
      var lastName = (formData.get('lastName') || '').toString().trim();
      var phone = (formData.get('phone') || '').toString().trim();

      if (!firstName || !lastName || !phone) {
        showMessage('error', 'Please fill in all required fields (First Name, Last Name, Phone Number).');
        return;
      }

      var experienceYearsValue = (formData.get('experienceYears') || '0').toString();
      var experienceYears = parseInt(experienceYearsValue || '0', 10) || 0;

      var data = {
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        experienceYears: experienceYears,
        skills: skills,
        token: (formData.get('token') || '').toString(),
        uid: (formData.get('uid') || '').toString()
      };

      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
      }

      showMessage('', '');

      fetch('/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function(response) {
          return response.json().then(function(result) {
            return { ok: response.ok, result: result };
          });
        })
        .then(function(payload) {
          var ok = payload.ok;
          var result = payload.result || {};
          if (ok) {
            showMessage('success', result.message || 'Profile completed successfully! You can now log into the SPANA app to upload verification documents.');
            if (btn) {
              btn.textContent = 'Profile Completed ✓';
            }
            setTimeout(function() {
              window.location.href = '/complete-registration?success=true&token=' +
                encodeURIComponent(data.token) +
                '&uid=' +
                encodeURIComponent(data.uid);
            }, 2000);
          } else {
            showMessage('error', result.message || 'Failed to complete profile. Please try again.');
            if (btn) {
              btn.disabled = false;
              btn.textContent = 'Complete Profile';
            }
          }
        })
        .catch(function(error) {
          console.error('Form submission error:', error);
          showMessage('error', 'An error occurred. Please check your connection and try again.');
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Complete Profile';
          }
        });
    });
  }
})();
`;

    res.type('application/javascript').send(script);
  } catch (error) {
    console.error('Complete registration script error:', error);
    res
      .type('application/javascript')
      .send('console.error("Failed to load complete-registration script.");');
  }
};

// Handle profile completion submission
exports.submitProfile = async (req: any, res: any) => {
  try {
    const { firstName, lastName, phone, experienceYears, skills, token, uid } = req.body;

    if (!token || !uid) {
      return res.status(400).json({ message: 'Missing token or uid' });
    }

    // Find user and provider
    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: {
        serviceProvider: true
      }
    });

    if (!user || user.role !== 'service_provider' || !user.serviceProvider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const provider = user.serviceProvider;

    // Validate token
    if (!provider.verificationToken || provider.verificationToken !== token) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // LAZY EXPIRATION: Check if token expired (30 minutes from first use)
    const now = new Date();
    if (provider.verificationTokenFirstUsedAt) {
      // Token has been used before - check if it's expired (30 minutes from first use)
      const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutes
      const expiresAt = new Date(
        provider.verificationTokenFirstUsedAt.getTime() + thirtyMinutesInMs
      );

      if (now > expiresAt) {
        return res.status(400).json({ 
          message: 'Token expired. The token expires 30 minutes after first use. Please request a new one.' 
        });
      }
    }
    // If verificationTokenFirstUsedAt is null, token hasn't been used yet (shouldn't happen if GET was called first, but handle gracefully)

    // Update user profile
    await prisma.user.update({
      where: { id: uid },
      data: {
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        phone: phone || user.phone
      }
    });

    // Update provider profile and mark as verified
    // Also ensure email and identity verification flags are set correctly
    const updatedProvider = await prisma.serviceProvider.update({
      where: { userId: uid },
      data: {
        experienceYears: experienceYears || 0,
        skills: Array.isArray(skills) ? skills : [],
        isVerified: true, // Already verified by admin
        isIdentityVerified: true, // Already verified by admin during application review
        isProfileComplete: true,
        verificationToken: null,
        verificationExpires: null
      }
    });

    // Send credentials email with password
    if (updatedProvider.temporaryPassword) {
      try {
        console.log(`[Registration] Sending provider credentials email to ${user.email}...`);
        const emailService = require('../lib/emailService');
        const appDownloadLink = process.env.APP_DOWNLOAD_LINK || 'https://spana.co.za/download';
        
        await emailService.sendProviderCredentialsEmailViaService({
          to: user.email,
          name: `${firstName || user.firstName} ${lastName || user.lastName}`,
          email: user.email,
          password: updatedProvider.temporaryPassword,
          appDownloadLink
        });
        
        console.log(`[Registration] ✅ Provider credentials email sent to ${user.email}`);
        // Note: Password remains stored until user changes it themselves
      } catch (emailError: any) {
        console.error('[Registration] ❌ Failed to send provider credentials email:', emailError.message);
        // Don't fail profile completion if email fails - provider can request password reset
      }
    }

    // Ensure user email verification is set (they received credentials via email)
    await prisma.user.update({
      where: { id: uid },
      data: {
        isEmailVerified: true, // Email verified because they received credentials via email
        isPhoneVerified: null // Phone verification not a priority
      }
    });

    res.json({
      message: 'Profile completed successfully! You can now start receiving bookings. Check your email for login credentials.',
      user: {
        id: user.id,
        email: user.email,
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName
      }
    });
  } catch (error) {
    console.error('Submit profile error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};


export {};
