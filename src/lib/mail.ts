import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { logger } from "@/lib/logger";
import { sendViaResend } from "@/lib/mail-resend";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";
const MAIL_LOG_FILE = process.env.MAIL_LOG_FILE || "";

function isCloudflare(): boolean {
  return process.env.DEPLOY_TARGET === "cloudflare";
}

function logMail(to: string, type: string, url: string): void {
  if (isCloudflare()) return;
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

function getTransporter(): Transporter {
  validateSmtpConfig();
  return getSmtpTransporter()!;
}

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail(payload: EmailPayload, logType: string, logUrl: string, errorMsg: string): Promise<void> {
  if (isCloudflare()) {
    try {
      await sendViaResend({ from: SMTP_FROM, ...payload });
    } catch (error) {
      logger.error({ err: error }, errorMsg);
      throw error;
    }
  } else {
    const transport = getTransporter();
    try {
      await transport.sendMail({ from: SMTP_FROM, ...payload });
    } catch (error) {
      logger.error({ err: error }, errorMsg);
      throw new Error(errorMsg);
    }
  }
  logMail(payload.to, logType, logUrl);
}

const BODY_STYLE = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;";
const BTN_STYLE = "background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;";

function emailShell(heading: string, body: string, link: string, btnText: string, footer: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="${BODY_STYLE}">
  <h1 style="color: #0070f3; margin-bottom: 24px;">${heading}</h1>
  <p style="margin-bottom: 16px;">${body}</p>
  <p style="margin: 32px 0;"><a href="${link}" style="${BTN_STYLE}">${btnText}</a></p>
  <p style="margin-bottom: 16px; color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
  <p style="margin-bottom: 32px; word-break: break-all; font-size: 14px; color: #666;">${link}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px;">${footer}</p>
</body></html>`;
}

export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Sign in to Ideate",
    text: `Click the link below to sign in to Ideate:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this email, you can safely ignore it.`,
    html: emailShell("Sign in to Ideate", "Click the button below to sign in to your Ideate account:", magicLink, "Sign In",
      "This link will expire in 15 minutes. If you didn't request this email, you can safely ignore it."),
  }, "magic-link", magicLink, "Failed to send email");
}

export async function sendVerificationEmail(email: string, verifyLink: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Verify your email - Ideate",
    text: `Welcome to Ideate!\n\nPlease verify your email address by clicking the link below:\n\n${verifyLink}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.`,
    html: emailShell("Welcome to Ideate!", "Please verify your email address to activate your account:", verifyLink, "Verify Email",
      "This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email."),
  }, "verification", verifyLink, "Failed to send verification email");
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Reset your password - Ideate",
    text: `You requested a password reset for your Ideate account.\n\nClick the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: emailShell("Reset Your Password", "You requested a password reset for your Ideate account. Click the button below to set a new password:", resetLink, "Reset Password",
      "This link will expire in 1 hour. If you didn't request this, you can safely ignore this email."),
  }, "reset", resetLink, "Failed to send password reset email");
}

export async function sendInvitationEmail(email: string, inviteLink: string, inviterEmail: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "You're invited to Ideate",
    text: `You've been invited to join Ideate by ${inviterEmail}.\n\nClick the link below to create your account:\n\n${inviteLink}\n\nThis invitation expires in 7 days.\n\nIf you weren't expecting this invitation, you can safely ignore this email.`,
    html: emailShell("You're Invited to Ideate!", `${inviterEmail} has invited you to join Ideate, a democratic idea prioritization platform.`, inviteLink, "Create Account",
      "This invitation expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email."),
  }, "invitation", inviteLink, "Failed to send invitation email");
}

export async function sendEmailChangeEmail(newEmail: string, verifyLink: string): Promise<void> {
  await sendEmail({
    to: newEmail,
    subject: "Confirm your new email - Ideate",
    text: `You requested to change your Ideate email to this address.\n\nClick the link below to confirm:\n\n${verifyLink}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: emailShell("Confirm Email Change", "You requested to change your Ideate email to this address. Click below to confirm:", verifyLink, "Confirm Email",
      "This link expires in 1 hour. If you didn't request this, ignore this email."),
  }, "email-change", verifyLink, "Failed to send email change verification");
}

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
