import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  throw new Error(
    "SMTP configuration required: SMTP_HOST, SMTP_USER, SMTP_PASS"
  );
}

let transporter: Transporter | null = null;

/**
 * Get or create SMTP transporter singleton
 * @returns Nodemailer transporter
 */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

/**
 * Send magic link email
 * @param email - Recipient email address
 * @param magicLink - Magic link URL
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<void> {
  const transport = getTransporter();

  const subject = "Sign in to Ideate";
  const text = `Click the link below to sign in to Ideate:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this email, you can safely ignore it.`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0070f3; margin-bottom: 24px;">Sign in to Ideate</h1>
        <p style="margin-bottom: 16px;">Click the button below to sign in to your Ideate account:</p>
        <p style="margin: 32px 0;">
          <a href="${magicLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Sign In</a>
        </p>
        <p style="margin-bottom: 16px; color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="margin-bottom: 32px; word-break: break-all; font-size: 14px; color: #666;">${magicLink}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px; margin-bottom: 8px;">This link will expire in 15 minutes.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this email, you can safely ignore it.</p>
      </body>
    </html>
  `;

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to: email,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send magic link email:", error);
    throw new Error("Failed to send email");
  }
}

/**
 * Verify SMTP connection
 * @returns True if connection successful
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return true;
  } catch (error) {
    console.error("SMTP connection failed:", error);
    return false;
  }
}
