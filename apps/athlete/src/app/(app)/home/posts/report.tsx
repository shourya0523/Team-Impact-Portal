import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { ReportForm } from '@/components/Report';
import { Async, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Card } from '@/ui';

/** "/home/posts/report?id=": report a post from its page, and optionally block its author. */
export default function ReportPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useRole();
  const post = useApi(() => api.getPost(id), [id]);
  return (
    <Screen eyebrow="Report" title="Report this post" back>
      <Gutter>
        <Async state={post.state}>
          {(p) => (
            <Card>
              <ReportForm
                target={{ kind: 'post', id: p.id }}
                author={
                  p.author.role === 'staff' || p.author.id === me?.id
                    ? undefined
                    : { id: p.author.id, name: p.author.firstName }
                }
                // The post is hidden for you now, so leave its page too.
                onClose={() => router.replace('/home')}
              />
            </Card>
          )}
        </Async>
      </Gutter>
    </Screen>
  );
}
