import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "@/lib/logger";

let transporter: Transporter | null = null;

/** Optional SMTP transport for project notifications; authentication is SSO-only. */
export function getSmtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  }
  return transporter;
}

/** Check optional notification delivery without sending an email. */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    const transport = getSmtpTransporter();
    if (!transport) return false;
    await transport.verify();
    return true;
  } catch (error) {
    logger.error({ err: error }, "SMTP verification failed");
    return false;
  }
}
