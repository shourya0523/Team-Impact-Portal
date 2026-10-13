import { router } from 'expo-router';
import { Linking, Text, View } from 'react-native';
import type { Post } from '@team-impact/contracts';
import { api } from '@/api';
import { KIND_LABEL, ROLE_LABEL, shortDate } from '@/components/format';
import { Async, Button, Card, Pill, Screen, text } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function PostCard({ post }: { post: Post }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={text.strong}>
          {post.author.firstName} {post.author.lastName}
          <Text style={text.muted}> · {ROLE_LABEL[post.author.role]}</Text>
        </Text>
        <Text style={text.muted}>{shortDate(post.createdAt)}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pill label={`${KIND_LABEL[post.community.kind]} · ${post.community.name}`} tone="brand" />
        {post.official && <Pill label="Official" tone="brand" />}
        {post.moderation !== 'approved' && <Pill label="Waiting for review" tone="warn" />}
      </View>
      <Text style={text.body}>{post.text}</Text>
      {post.kind === 'opportunity' && (
        <Card onPress={() => Linking.openURL(post.opportunity.link)}>
          <Text style={text.strong}>{post.opportunity.title}</Text>
          <Text style={text.muted}>
            {post.opportunity.company.name}
            {post.opportunity.closesOn ? ` · closes ${post.opportunity.closesOn}` : ''}
          </Text>
        </Card>
      )}
      <Text style={text.muted}>
        {plural(post.likeCount, 'like')} · {plural(post.commentCount, 'comment')}
      </Text>
    </Card>
  );
}

/**
 * "/home": the feed from every community you're in, team first, then your other communities,
 * then Team Impact. Medical communities' posts stay in their own feed. Parents and recruiters don't post, so they get no composer (F5).
 */
export default function Home() {
  const { role } = useRole();
  const { state } = useApi(() => api.feed());
  const canPost = role !== 'parent' && role !== 'recruiter';
  return (
    <Screen
      title="Home"
      actions={
        <>
          {canPost && <Button label="New post" onPress={() => router.push('/home/compose')} />}
          <Button
            label="Notifications"
            kind="secondary"
            onPress={() => router.push('/home/notifications')}
          />
        </>
      }
    >
      <Async state={state}>
        {(page) =>
          page.items.length ? (
            page.items.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <Text style={text.muted}>Nothing here yet. Join a community to fill your feed.</Text>
          )
        }
      </Async>
    </Screen>
  );
}
