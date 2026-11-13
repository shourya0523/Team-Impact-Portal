import { useState } from 'react';
import type { Community } from '@team-impact/contracts';
import { api } from '../../api';
import { Button, Select, Text } from '../../ui';
import { useApi } from '../../useApi';

/**
 * The communities staff may write in, Team Impact's first, and the one picked (the first until
 * staff choose). `can` is `canPostIn` or `canCreateEventIn`: membership is needed, so in practice
 * Team Impact's plus any community staff joined. `state` says whether the list is still loading
 * or failed, so the picker can say so instead of sitting empty.
 */
export const useCommunityChoice = (can: (c: Community) => boolean) => {
  const communities = useApi(() => api.communities());
  const [communityId, setCommunityId] = useState('');
  const options =
    communities.state.status === 'ready'
      ? communities.state.data
          .filter(can)
          .sort((a, b) => Number(b.kind === 'team_impact') - Number(a.kind === 'team_impact'))
      : [];
  const chosen = options.find((c) => c.id === communityId) ?? options[0];
  return {
    state: communities.state,
    retry: communities.reload,
    options,
    chosen,
    choose: setCommunityId,
  };
};

export const CommunitySelect = ({
  state,
  retry,
  options,
  chosen,
  choose,
}: ReturnType<typeof useCommunityChoice>) => {
  if (state.status === 'error') {
    return (
      <div>
        <Text role="alert" color="danger">
          Couldn’t load your communities: {state.error.message}
        </Text>
        <Button label="Try again" variant="secondary" size="sm" onClick={() => retry()} />
      </div>
    );
  }
  const loading = state.status === 'loading';
  return (
    <Select
      label="Community"
      value={chosen?.id ?? ''}
      disabled={loading || options.length === 0}
      aria-busy={loading}
      onChange={(e) => choose(e.target.value)}
    >
      {loading ? (
        <option value="">Loading communities…</option>
      ) : options.length === 0 ? (
        <option value="">No community you can write in yet</option>
      ) : (
        options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))
      )}
    </Select>
  );
};
