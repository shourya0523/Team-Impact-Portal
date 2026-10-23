import { Linking } from 'react-native';
import type { SharedContact } from '@team-impact/contracts';
import { Text } from '@/ui';

/** `tel:` links want digits (and a leading +) only: "+1 (617) 555-0100" dials as "+16175550100". */
const dialable = (phone: string) => phone.replace(/[^+\d]/g, '');

/**
 * Contact details someone chose to share, as tappable links: email opens the mail app, phone the
 * dialler, LinkedIn the browser. Renders only the channels present; the API leaves out anything
 * the viewer isn't meant to see, so there is nothing to filter here.
 */
export function ContactLinks({ contact }: { contact: SharedContact }) {
  const links = [
    contact.email && { label: contact.email, url: `mailto:${contact.email}` },
    contact.phone && { label: contact.phone, url: `tel:${dialable(contact.phone)}` },
    contact.linkedinUrl && { label: 'LinkedIn', url: contact.linkedinUrl },
  ].filter((l): l is { label: string; url: string } => !!l);

  return links.map((l) => (
    <Text
      key={l.url}
      variant="small"
      color="brand"
      accessibilityRole="link"
      onPress={() => void Linking.openURL(l.url)}
    >
      {l.label}
    </Text>
  ));
}

/** True when there is at least one channel to show. */
export const hasContact = (contact: SharedContact) =>
  !!(contact.email || contact.phone || contact.linkedinUrl);
