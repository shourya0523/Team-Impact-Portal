import { useState } from 'react';
import { sampleTeams } from './fixtures';
import { Badge, Button, Card, FadeSlideIn, Input, Logo, Sheet, TeamAvatar, Text } from './ui';

/** Sample page: every Signing Day token on one screen. Real routes land in later tickets. */
export const App = () => {
  const [open, setOpen] = useState(false);
  return (
    <main className="ti-page ti-stack">
      <FadeSlideIn>
        <Logo size="md" />
        <Text variant="eyebrow" color="secondary">
          Signing Day
        </Text>
        <Text variant="display" size="xl">
          Team Impact Portal
        </Text>
      </FadeSlideIn>
      <FadeSlideIn delay={80}>
        <Text variant="body" color="secondary">
          Recruiter and staff portal. Body text is Barlow 16 on the ground colour.
        </Text>
      </FadeSlideIn>
      <FadeSlideIn delay={160}>
        <Card>
          <div className="ti-row">
            <TeamAvatar name="Austin Hawks" teamColor={sampleTeams.hawks} size="lg" />
            <TeamAvatar name="Rookie Squad" size="lg" />
            <Badge label="Pending" variant="warning" />
          </div>
          <Text variant="small" color="muted">
            Team avatars take a runtime team colour and default to brand.
          </Text>
          <Input label="Search teams" placeholder="e.g. Hawks" />
          <div className="ti-row">
            <Button label="Request access" size="lg" onClick={() => setOpen(true)} />
            <Button label="Not now" variant="secondary" size="lg" />
          </div>
        </Card>
      </FadeSlideIn>
      <FadeSlideIn delay={240}>
        <Card variant="dark">
          <Logo size="lg" variant="dark" />
        </Card>
      </FadeSlideIn>
      <Sheet open={open} title="Request sent" onClose={() => setOpen(false)}>
        <Text variant="body" color="secondary">
          Staff will review it.
        </Text>
        <Button label="Done" onClick={() => setOpen(false)} />
      </Sheet>
    </main>
  );
};
