import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import type { College } from '@team-impact/contracts';
import { api } from '@/api';
import { Async, Button, Card, Screen, text } from '@/components/ui';
import { useApi } from '@/hooks/useApi';

/** For teams that aren't registered yet (PRD §3, P7). */
const askForTeam = (college: College) =>
  Linking.openURL(
    `mailto:appdev@teamimpact.org?subject=${encodeURIComponent(
      `Add my team: ${college.name}`,
    )}&body=${encodeURIComponent(`College: ${college.name}\nSport: `)}`,
  );

/** "/onboarding/find-team": pick the college, then the team. Only live teams are listed. */
export default function FindTeam() {
  const [college, setCollege] = useState<College | null>(null);
  const colleges = useApi(() => api.colleges());
  const teams = useApi(
    () => (college ? api.teams(college.id) : Promise.resolve([])),
    [college?.id],
  );

  if (!college) {
    return (
      <Screen title="Find your team" subtitle="Start with your college.">
        <Async state={colleges.state}>
          {(list) =>
            list.map((c) => (
              <Card key={c.id} onPress={() => setCollege(c)}>
                <Text style={text.strong}>{c.name}</Text>
              </Card>
            ))
          }
        </Async>
        <Button
          label="Scan a team QR code instead"
          kind="secondary"
          onPress={() => router.push('/scan')}
        />
      </Screen>
    );
  }

  return (
    <Screen title={college.name} subtitle="Pick your team.">
      <Async state={teams.state}>
        {(list) =>
          list.length ? (
            list.map((t) => (
              <Card
                key={t.id}
                onPress={() =>
                  router.push({
                    pathname: '/onboarding/request',
                    params: { teamId: t.id, teamName: `${t.college.name} ${t.name}` },
                  })
                }
              >
                <Text style={text.strong}>{t.name}</Text>
                <Text style={text.muted}>
                  {t.sport} · Division {t.division}
                </Text>
              </Card>
            ))
          ) : (
            <Card>
              <Text style={text.strong}>No teams here yet</Text>
              <Text style={text.muted}>Ask us to add yours. We’ll email when it’s ready.</Text>
              <Button label="Email appdev@teamimpact.org" onPress={() => askForTeam(college)} />
            </Card>
          )
        }
      </Async>
      <Button label="Change college" kind="secondary" onPress={() => setCollege(null)} />
    </Screen>
  );
}
