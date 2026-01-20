import prisma from '../lib/database';

// Complete registration page - renders HTML form for provider profile completion
exports.completeRegistration = async (req: any, res: any) => {
  try {
    const { token, uid } = req.query;

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

    // Check if token expired
    if (provider.verificationExpires && provider.verificationExpires < new Date()) {
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
            <p>The verification link has expired. Please request a new one.</p>
          </div>
        </body>
        </html>
      `);
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
                <input type="number" name="experienceYears" value="${provider.experienceYears || 0}" min="0" required>
              </div>
              <div class="form-group">
                <label>Skills (Add your service skills)</label>
                <div id="skillsContainer" class="skills-input">
                  ${(provider.skills || []).map((skill: string) => `
                    <span class="skill-tag">
                      ${skill}
                      <button type="button" onclick="removeSkill('${skill}')">×</button>
                    </span>
                  `).join('')}
                </div>
                <div class="add-skill" style="margin-top: 10px;">
                  <input type="text" id="newSkill" placeholder="Add a skill and press Enter">
                  <button type="button" onclick="addSkill()" style="background: #0066CC; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer;">Add</button>
                </div>
              </div>
              <input type="hidden" name="token" id="tokenInput" value="${token}">
              <input type="hidden" name="uid" id="uidInput" value="${uid}">
              <button type="submit" class="btn">Complete Profile</button>
            </form>
          </div>
        </div>
        <script>
          // Get token and uid from URL params if not in hidden fields
          const urlParams = new URLSearchParams(window.location.search);
          const tokenFromUrl = urlParams.get('token');
          const uidFromUrl = urlParams.get('uid');
          
          if (tokenFromUrl) {
            document.getElementById('tokenInput').value = tokenFromUrl;
          }
          if (uidFromUrl) {
            document.getElementById('uidInput').value = uidFromUrl;
          }
          
          let skills = ${JSON.stringify(provider.skills || [])};
          
          function addSkill() {
            const input = document.getElementById('newSkill');
            const skill = input.value.trim();
            if (skill && !skills.includes(skill)) {
              skills.push(skill);
              renderSkills();
              input.value = '';
            }
          }
          
          function removeSkill(skill) {
            skills = skills.filter(s => s !== skill);
            renderSkills();
          }
          
          function renderSkills() {
            const container = document.getElementById('skillsContainer');
            container.innerHTML = skills.map(skill => \`
              <span class="skill-tag">
                \${skill}
                <button type="button" onclick="removeSkill('\${skill}')">×</button>
              </span>
            \`).join('');
          }
          
          document.getElementById('newSkill').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSkill();
            }
          });
          
          document.getElementById('profileForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            
            // Validate required fields
            const firstName = formData.get('firstName')?.toString().trim();
            const lastName = formData.get('lastName')?.toString().trim();
            const phone = formData.get('phone')?.toString().trim();
            
            if (!firstName || !lastName || !phone) {
              const messageEl = document.getElementById('message');
              messageEl.classList.add('show', 'error');
              messageEl.textContent = 'Please fill in all required fields (First Name, Last Name, Phone Number).';
              return;
            }
            
            const data = {
              firstName: firstName,
              lastName: lastName,
              phone: phone,
              experienceYears: parseInt(formData.get('experienceYears')?.toString() || '0'),
              skills: skills,
              token: formData.get('token')?.toString(),
              uid: formData.get('uid')?.toString()
            };
            
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Saving...';
            
            const messageEl = document.getElementById('message');
            messageEl.classList.remove('show', 'success', 'error');
            
            try {
              const response = await fetch('/complete-registration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              
              const result = await response.json();
              
              if (response.ok) {
                messageEl.classList.add('show', 'success');
                messageEl.textContent = result.message || 'Profile completed successfully! You can now start receiving bookings.';
                btn.textContent = 'Profile Completed ✓';
                setTimeout(() => {
                  window.location.href = '/complete-registration?success=true&token=' + encodeURIComponent(data.token) + '&uid=' + encodeURIComponent(data.uid);
                }, 2000);
              } else {
                messageEl.classList.add('show', 'error');
                messageEl.textContent = result.message || 'Failed to complete profile. Please try again.';
                btn.disabled = false;
                btn.textContent = 'Complete Profile';
              }
            } catch (error) {
              console.error('Form submission error:', error);
              messageEl.classList.add('show', 'error');
              messageEl.textContent = 'An error occurred. Please check your connection and try again.';
              btn.disabled = false;
              btn.textContent = 'Complete Profile';
            }
          });
          
        </script>
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

    // Check expiration
    if (provider.verificationExpires && provider.verificationExpires < new Date()) {
      return res.status(400).json({ message: 'Token expired' });
    }

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
    await prisma.serviceProvider.update({
      where: { userId: uid },
      data: {
        experienceYears: experienceYears || 0,
        skills: Array.isArray(skills) ? skills : [],
        isVerified: true,
        isProfileComplete: true,
        verificationToken: null,
        verificationExpires: null
      }
    });

    res.json({
      message: 'Profile completed successfully! You can now start receiving bookings.',
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
