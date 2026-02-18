import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { logger } from "@/lib/logger";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";
const MAIL_LOG_FILE = process.env.MAIL_LOG_FILE || "";

function logMail(to: string, type: string, url: string): void {
  const logFile = MAIL_LOG_FILE || (process.env.NODE_ENV !== "production" ? "/tmp/ideate-mail.log" : "");
  if (!logFile) return;
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    const entry = JSON.stringify({ to, type, url, timestamp: new Date().toISOString() });
    appendFileSync(logFile, entry + "\n");
  } catch {
    // Non-critical: don't break email sending if logging fails
  }
}

function validateSmtpConfig(): void {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "SMTP configuration required: SMTP_HOST, SMTP_USER, SMTP_PASS"
    );
  }
}

let transporter: Transporter | null = null;

/**
 * Get or create SMTP transporter singleton (returns null if not configured).
 * Use for optional sends like notifications where missing SMTP is acceptable.
 */
export function getSmtpTransporter(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Get or create SMTP transporter singleton (throws if not configured).
 * Use for required sends like auth emails.
 * @returns Nodemailer transporter
 */
function getTransporter(): Transporter {
  validateSmtpConfig();
  return getSmtpTransporter()!;
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
    logMail(email, "magic-link", magicLink);
  } catch (error) {
    logger.error({ err: error }, "Failed to send magic link email");
    throw new Error("Failed to send email");
  }
}

/**
 * Send email verification email
 * @param email - Recipient email address
 * @param verifyLink - Verification URL
 */
export async function sendVerificationEmail(
  email: string,
  verifyLink: string
): Promise<void> {
  const transport = getTransporter();

  const subject = "Verify your email - Ideate";
  const text = `Welcome to Ideate!\n\nPlease verify your email address by clicking the link below:\n\n${verifyLink}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0070f3; margin-bottom: 24px;">Welcome to Ideate!</h1>
        <p style="margin-bottom: 16px;">Please verify your email address to activate your account:</p>
        <p style="margin: 32px 0;">
          <a href="${verifyLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Verify Email</a>
        </p>
        <p style="margin-bottom: 16px; color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="margin-bottom: 32px; word-break: break-all; font-size: 14px; color: #666;">${verifyLink}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px; margin-bottom: 8px;">This link will expire in 24 hours.</p>
        <p style="color: #999; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
      </body>
    </html>
  `;

  try {
    await transport.sendMail({ from: SMTP_FROM, to: email, subject, text, html });
    logMail(email, "verification", verifyLink);
  } catch (error) {
    logger.error({ err: error }, "Failed to send verification email");
    throw new Error("Failed to send verification email");
  }
}

/**
 * Send password reset email
 * @param email - Recipient email address
 * @param resetLink - Password reset URL
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<void> {
  const transport = getTransporter();

  const subject = "Reset your password - Ideate";
  const text = `You requested a password reset for your Ideate account.\n\nClick the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0070f3; margin-bottom: 24px;">Reset Your Password</h1>
        <p style="margin-bottom: 16px;">You requested a password reset for your Ideate account. Click the button below to set a new password:</p>
        <p style="margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Reset Password</a>
        </p>
        <p style="margin-bottom: 16px; color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="margin-bottom: 32px; word-break: break-all; font-size: 14px; color: #666;">${resetLink}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px; margin-bottom: 8px;">This link will expire in 1 hour.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </body>
    </html>
  `;

  try {
    await transport.sendMail({ from: SMTP_FROM, to: email, subject, text, html });
    logMail(email, "reset", resetLink);
  } catch (error) {
    logger.error({ err: error }, "Failed to send password reset email");
    throw new Error("Failed to send password reset email");
  }
}

/**
 * Send invitation email
 * @param email - Recipient email address
 * @param inviteLink - Registration link with invitation token
 * @param inviterEmail - Email of the admin who sent the invitation
 */
export async function sendInvitationEmail(
  email: string,
  inviteLink: string,
  inviterEmail: string
): Promise<void> {
  const transport = getTransporter();

  const subject = "You're invited to Ideate";
  const text = `You've been invited to join Ideate by ${inviterEmail}.\n\nClick the link below to create your account:\n\n${inviteLink}\n\nThis invitation expires in 7 days.\n\nIf you weren't expecting this invitation, you can safely ignore this email.`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0070f3; margin-bottom: 24px;">You're Invited to Ideate!</h1>
        <p style="margin-bottom: 16px;">${inviterEmail} has invited you to join Ideate, a democratic idea prioritization platform.</p>
        <p style="margin: 32px 0;">
          <a href="${inviteLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Create Account</a>
        </p>
        <p style="margin-bottom: 16px; color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="margin-bottom: 32px; word-break: break-all; font-size: 14px; color: #666;">${inviteLink}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px; margin-bottom: 8px;">This invitation expires in 7 days.</p>
        <p style="color: #999; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
      </body>
    </html>
  `;

  try {
    await transport.sendMail({ from: SMTP_FROM, to: email, subject, text, html });
    logMail(email, "invitation", inviteLink);
  } catch (error) {
    logger.error({ err: error }, "Failed to send invitation email");
    throw new Error("Failed to send invitation email");
  }
}

/**
 * Send email change verification email to the NEW email address
 */
export async function sendEmailChangeEmail(
  newEmail: string,
  verifyLink: string
): Promise<void> {
  const transport = getTransporter();
  const subject = "Confirm your new email - Ideate";
  const text = `You requested to change your Ideate email to this address.\n\nClick the link below to confirm:\n\n${verifyLink}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #0070f3; margin-bottom: 24px;">Confirm Email Change</h1>
      <p>You requested to change your Ideate email to this address. Click below to confirm:</p>
      <p style="margin: 32px 0;"><a href="${verifyLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Confirm Email</a></p>
      <p style="color: #666; font-size: 14px;">${verifyLink}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
      <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </body></html>`;
  try {
    await transport.sendMail({ from: SMTP_FROM, to: newEmail, subject, text, html });
    logMail(newEmail, "email-change", verifyLink);
  } catch (error) {
    logger.error({ err: error }, "Failed to send email change verification");
    throw new Error("Failed to send email change verification");
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
    logger.error({ err: error }, "SMTP connection failed");
    return false;
  }
}
