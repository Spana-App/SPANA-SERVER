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
      : ['xoli@spana.co.za', 'nhlakanipho@spana.co.za', 'lungi@spana.co.za', 'no-reply@spana.co.za'];

    const emailSubject = subject && subject.trim()
      ? `[Spana Contact] ${subject.trim()}`
      : '[Spana Contact] New message from website';

    const safePhone = phone && String(phone).trim() ? String(phone).trim() : 'Not provided';

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
      <h2>New Spana Website Contact</h2>
      <p>You have received a new message from the Spana marketing website contact form.</p>
      <table cellpadding="4" cellspacing="0" style="border-collapse: collapse; margin-top: 12px;">
        <tr>
          <td style="font-weight: 600;">Name:</td>
          <td>${name}</td>
        </tr>
        <tr>
          <td style="font-weight: 600;">Email:</td>
          <td>${email}</td>
        </tr>
        <tr>
          <td style="font-weight: 600;">Phone:</td>
          <td>${safePhone}</td>
        </tr>
      </table>
      <h3 style="margin-top: 20px;">Message</h3>
      <p style="white-space: pre-line;">${message}</p>
      <hr style="margin-top: 20px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">
        This email was sent via the Spana website contact form.
      </p>
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

