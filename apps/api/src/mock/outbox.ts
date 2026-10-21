import type { MockWorld } from './world';

/**
 * Email the mock API "sends": kept in memory and printed, so links that are never stored (coach
 * invite tokens) can still be opened in development. A real provider replaces this; nothing else
 * changes, because every email goes through `sendEmail`.
 */
export interface MockEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  /** The link the email carries, if any: for an invite, the only copy of its token. */
  link: string | null;
  sentAt: string;
}

export const sendEmail = (world: MockWorld, email: Omit<MockEmail, 'id' | 'sentAt'>) => {
  const sent: MockEmail = { ...email, id: world.newId(), sentAt: new Date().toISOString() };
  world.outbox.push(sent);
  // Tests send plenty of invites; only print when a person is running the API.
  if (process.env.NODE_ENV !== 'test')
    console.info(`✉ to ${sent.to}: ${sent.subject}\n  ${sent.link ?? ''}`);
  return sent;
};
