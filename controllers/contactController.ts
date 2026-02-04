import { sendEmailViaService, isEmailServiceEnabled } from '../lib/emailService';

// Simple public contact endpoint using existing email microservice
// POST /contact
// Body: { name, email, phone?, subject?, message }
exports.sendContactMessage = async (req: any, res: any) => {
  try {
    if (!isEmailServiceEnabled()) {
      return res.status(503).json({ message: 'Email service is not configured' });
    }

    const { name, email, phone, subject, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required' });
    }

    // Get contact emails from environment or use default list
    // Supports comma-separated list or single email
    const contactEmailsEnv = process.env.CONTACT_EMAIL || process.env.SUPPORT_EMAIL || process.env.DEFAULT_FROM_EMAIL;
    const contactEmails = contactEmailsEnv 
      ? contactEmailsEnv.split(',').map(email => email.trim()).filter(email => email)
      : ['xoli@spana.co.za', 'nhlakanipho@spana.co.za', 'lungi@spana.co.za'];

    const emailSubject = subject && subject.trim()
      ? `[Spana Contact] ${subject.trim()}`
      : '[Spana Contact] New message from website';

    const safePhone = phone && String(phone).trim() ? String(phone).trim() : 'Not provided';

    // Escape HTML to prevent XSS
    const escapeHtml = (text: string) => {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = subject ? escapeHtml(subject.trim()) : 'Contact Form Inquiry';
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const text = [
      `New contact form submission from the Spana website:`,
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${safePhone}`,
      '',
      `Message:`,
      message,
      '',
      '---',
      'This message was sent from the Spana marketing website contact form.'
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Form Submission</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F8F5; line-height: 1.6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F3F8F5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 10px 30px rgba(44, 75, 95, 0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3E72A8 0%, #2C4B5F 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                📧 New Contact Form Submission
              </h1>
              <p style="margin: 12px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                Spana Marketing Website
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              
              <!-- Intro -->
              <p style="margin: 0 0 30px; color: #0F1D18; font-size: 16px; line-height: 1.6;">
                You have received a new message from the Spana marketing website contact form.
              </p>

              <!-- Contact Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F3F8F5; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #E5E5E5;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="120" style="color: #5E7A94; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                                👤 Name
                              </td>
                            </tr>
                            <tr>
                              <td style="color: #0F1D18; font-size: 16px; font-weight: 500; padding-top: 4px;">
                                ${safeName}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #E5E5E5;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="120" style="color: #5E7A94; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                                ✉️ Email
                              </td>
                            </tr>
                            <tr>
                              <td style="color: #0F1D18; font-size: 16px; font-weight: 500; padding-top: 4px;">
                                <a href="mailto:${safeEmail}" style="color: #3E72A8; text-decoration: none;">${safeEmail}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="120" style="color: #5E7A94; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                                📞 Phone
                              </td>
                            </tr>
                            <tr>
                              <td style="color: #0F1D18; font-size: 16px; font-weight: 500; padding-top: 4px;">
                                ${safePhone}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Message Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 16px; color: #2C4B5F; font-size: 20px; font-weight: 600;">
                      💬 Message
                    </h2>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #FFFFFF; border: 2px solid #E5E5E5; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td style="color: #0F1D18; font-size: 15px; line-height: 1.7;">
                          ${safeMessage}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <a href="mailto:${safeEmail}?subject=Re: ${safeSubject}" style="display: inline-block; background: linear-gradient(135deg, #3E72A8 0%, #2C4B5F 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px;">
                      Reply to ${safeName}
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F3F8F5; padding: 24px 40px; text-align: center; border-top: 1px solid #E5E5E5;">
              <p style="margin: 0; color: #5E7A94; font-size: 12px; line-height: 1.5;">
                This email was sent via the Spana website contact form.<br>
                <span style="color: #2C4B5F; font-weight: 600;">SPANA</span> - Connecting you with trusted service professionals
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email to all recipients
    const emailPromises = contactEmails.map(contactEmail => 
      sendEmailViaService({
        to: contactEmail,
        subject: emailSubject,
        text,
        html,
        type: 'contact'
      }).catch((error: any) => {
        // Log error but don't fail the entire request if one email fails
        console.error(`[Contact Form] Failed to send email to ${contactEmail}:`, error?.message || error);
        return { error: true, email: contactEmail, message: error?.message };
      })
    );

    // Wait for all emails to be sent (or fail)
    const results = await Promise.allSettled(emailPromises);
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
    const failed = results.filter(r => r.status === 'rejected' || r.value?.error).length;
    
    console.log(`[Contact Form] Email sent to ${successful}/${contactEmails.length} recipients`);
    if (failed > 0) {
      console.warn(`[Contact Form] ${failed} email(s) failed to send`);
    }

    return res.json({ message: 'Contact message sent successfully' });
  } catch (error: any) {
    console.error('Contact form email error:', error?.message || error);
    return res.status(500).json({ message: 'Failed to send contact message' });
  }
};

