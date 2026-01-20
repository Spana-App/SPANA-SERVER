/**
 * Email Service Client
 * Proxies email requests to Vercel email microservice
 * This avoids SMTP port blocking on Render by using Vercel for email operations
 */

import axios, { AxiosError } from 'axios';

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'https://spana-email-service.vercel.app';
const EMAIL_SERVICE_SECRET = process.env.EMAIL_SERVICE_SECRET || process.env.API_SECRET;

interface EmailOptions {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  type?: string;
}

interface OTPEmailOptions {
  to: string;
  name: string;
  otp: string;
}

interface VerificationEmailOptions {
  to: string;
  name: string;
  verificationLink: string;
}

interface WelcomeEmailOptions {
  to: string;
  name: string;
  role: string;
  token?: string;
  uid?: string;
}

/**
 * Check if email service is enabled
 */
export function isEmailServiceEnabled(): boolean {
  return !!EMAIL_SERVICE_URL && !!EMAIL_SERVICE_SECRET;
}

/**
 * Send generic email via email service
 */
export async function sendEmailViaService(options: EmailOptions): Promise<any> {
  if (!isEmailServiceEnabled()) {
    throw new Error('Email service is not configured. Set EMAIL_SERVICE_URL and EMAIL_SERVICE_SECRET');
  }

  try {
    const response = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
      ...options,
      apiSecret: EMAIL_SERVICE_SECRET,
      type: options.type || 'generic'
    }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': EMAIL_SERVICE_SECRET
      }
    });

    return response.data;
  } catch (error: any) {
    const axiosError = error as AxiosError;
    console.error('[Email Service] Error sending email:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data
    });
    throw new Error(`Failed to send email: ${axiosError.message}`);
  }
}

/**
 * Send OTP email via email service
 */
export async function sendOTPEmailViaService(options: OTPEmailOptions): Promise<any> {
  if (!isEmailServiceEnabled()) {
    throw new Error('Email service is not configured. Set EMAIL_SERVICE_URL and EMAIL_SERVICE_SECRET');
  }

  try {
    const response = await axios.post(`${EMAIL_SERVICE_URL}/api/otp`, {
      to: options.to,
      name: options.name,
      otp: options.otp,
      apiSecret: EMAIL_SERVICE_SECRET
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': EMAIL_SERVICE_SECRET
      }
    });

    console.log(`[Email Service] OTP email sent to ${options.to}`);
    return response.data;
  } catch (error: any) {
    const axiosError = error as AxiosError;
    console.error('[Email Service] Error sending OTP email:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data
    });
    throw new Error(`Failed to send OTP email: ${axiosError.message}`);
  }
}

/**
 * Send verification email via email service
 */
export async function sendVerificationEmailViaService(options: VerificationEmailOptions): Promise<any> {
  if (!isEmailServiceEnabled()) {
    throw new Error('Email service is not configured. Set EMAIL_SERVICE_URL and EMAIL_SERVICE_SECRET');
  }

  try {
    const response = await axios.post(`${EMAIL_SERVICE_URL}/api/verification`, {
      to: options.to,
      name: options.name,
      verificationLink: options.verificationLink,
      apiSecret: EMAIL_SERVICE_SECRET
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': EMAIL_SERVICE_SECRET
      }
    });

    console.log(`[Email Service] Verification email sent to ${options.to}`);
    return response.data;
  } catch (error: any) {
    const axiosError = error as AxiosError;
    console.error('[Email Service] Error sending verification email:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data
    });
    throw new Error(`Failed to send verification email: ${axiosError.message}`);
  }
}

/**
 * Send welcome email via email service
 */
export async function sendWelcomeEmailViaService(options: WelcomeEmailOptions): Promise<any> {
  if (!isEmailServiceEnabled()) {
    throw new Error('Email service is not configured. Set EMAIL_SERVICE_URL and EMAIL_SERVICE_SECRET');
  }

  try {
    const response = await axios.post(`${EMAIL_SERVICE_URL}/api/welcome`, {
      to: options.to,
      name: options.name,
      role: options.role,
      token: options.token,
      uid: options.uid,
      apiSecret: EMAIL_SERVICE_SECRET
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': EMAIL_SERVICE_SECRET
      }
    });

    console.log(`[Email Service] Welcome email sent to ${options.to}`);
    return response.data;
  } catch (error: any) {
    const axiosError = error as AxiosError;
    console.error('[Email Service] Error sending welcome email:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data
    });
    throw new Error(`Failed to send welcome email: ${axiosError.message}`);
  }
}

/**
 * Health check for email service
 */
export async function checkEmailServiceHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${EMAIL_SERVICE_URL}/api/health`, {
      timeout: 5000
    });
    return response.status === 200 && response.data.status === 'healthy';
  } catch (error) {
    console.error('[Email Service] Health check failed:', error);
    return false;
  }
}
