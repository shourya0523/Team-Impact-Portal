import { Linking } from 'react-native';
import type { ContactSharing, SharedContact } from '@team-impact/contracts';
import { track } from '@/api';
import { Text } from '@/ui';

/** `tel:` links want digits (and a leading +) only: "+1 (617) 555-0100" dials as "+16175550100". */
const dialable = (phone: string) => phone.replace(/[^+\d]/g, '');

/**
 * Contact details someone chose to share, as tappable links: email opens the mail app, phone the
 * dialler, LinkedIn the browser. Renders only the channels present; the API leaves out anything
 * the viewer isn't meant to see, so there is nothing to filter here. Each tap logs `contact.viewed`
 * against `ownerId`, the person the details belong to.
 */
export function ContactLinks({ contact, ownerId }: { contact: SharedContact; ownerId: string }) {
  type Link = { channel: keyof ContactSharing; label: string; url: string };
  const links = [
    contact.email && { channel: 'email', label: contact.email, url: `mailto:${contact.email}` },
    contact.phone && {
      channel: 'phone',
      label: contact.phone,
      url: `tel:${dialable(contact.phone)}`,
    },
    contact.linkedinUrl && { channel: 'linkedin', label: 'LinkedIn', url: contact.linkedinUrl },
  ].filter((l): l is Link => !!l);

  return links.map((l) => (
    <Text
      key={l.url}
      variant="small"
      color="brand"
      accessibilityRole="link"
      onPress={() => {
        track({ name: 'contact.viewed', properties: { channel: l.channel }, subjectId: ownerId });
        void Linking.openURL(l.url);
      }}
    >
      {l.label}
    </Text>
  ));
}

/** True when there is at least one channel to show. */
export const hasContact = (contact: SharedContact) =>
  !!(contact.email || contact.phone || contact.linkedinUrl);
