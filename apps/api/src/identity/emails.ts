// The text of every auth email. auth.ts decides when to send them and builds the links; the mailer
// sends them. Plain text, and nothing beyond the recipient's first name and a link: never another
// person's details.
import type { MailMessage } from './mailer';

const sign = (lines: string[]) => [...lines, '', 'Team Impact'].join('\n');

export const verificationEmail = (to: string, firstName: string, url: string): MailMessage => ({
  to,
  subject: 'Confirm your email for Team Impact',
  text: sign([
    `Hi ${firstName},`,
    '',
    'Confirm this is your email address to finish creating your Team Impact account:',
    url,
    '',
    'The link works once and expires in 24 hours. If you didn’t sign up, you can ignore this email.',
  ]),
});

export const passwordResetEmail = (to: string, firstName: string, url: string): MailMessage => ({
  to,
  subject: 'Reset your Team Impact password',
  text: sign([
    `Hi ${firstName},`,
    '',
    'Someone asked to reset the password for your Team Impact account. Choose a new one here:',
    url,
    '',
    'The link works once and expires in 30 minutes. Resetting signs you out on every device.',
    'If you didn’t ask for this, ignore this email: your password stays the same.',
  ]),
});

/**
 * Sent instead of a second account when someone signs up with an address that already has one.
 * The sign-up response looks the same either way, so it can't be used to find out who's registered.
 */
export const accountExistsEmail = (to: string, firstName: string): MailMessage => ({
  to,
  subject: 'You already have a Team Impact account',
  text: sign([
    `Hi ${firstName},`,
    '',
    'Someone tried to create a Team Impact account with this email address, but you already have one.',
    'If it was you, sign in instead, or use “Forgot password” if you need a new one.',
    'If it wasn’t you, you can ignore this email: nothing has changed.',
  ]),
});
