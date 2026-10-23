// =============================================================================================
// Email sending, behind one small interface so the rest of auth never cares how mail leaves.
//
//   createSmtpMailer    production: any SMTP provider (Postmark, SES, Resend, …) via SMTP_URL
//   createLogMailer     development: prints each email, links included, to the API log
//   createMemoryMailer  tests: keeps messages in a list the tests read links from
//
// env.ts refuses to start production without SMTP_URL, so real users never get a logged email.
// =============================================================================================
import type { FastifyBaseLogger } from 'fastify';
import nodemailer from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** SMTP works with every major provider, so no provider SDK is needed. */
export const createSmtpMailer = (smtpUrl: string, from: string): Mailer => {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(message) {
      await transport.sendMail({ from, ...message });
    },
  };
};

/** Development only: the email, link included, appears in the API's terminal. */
export const createLogMailer = (log: FastifyBaseLogger): Mailer => ({
  async send({ to, subject, text }) {
    log.info({ mail: { to, subject } }, `Email not sent (no SMTP_URL). Contents:\n${text}`);
  },
});

/** For tests: `sent` holds every message, newest last. */
export const createMemoryMailer = (): Mailer & { sent: MailMessage[] } => {
  const sent: MailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
};
