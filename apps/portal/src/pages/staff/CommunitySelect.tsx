import { useState } from 'react';
import type { Community } from '@team-impact/contracts';
import { api } from '../../api';
import { Select } from '../../ui';
import { useApi } from '../../useApi';

/**
 * The communities staff may write in, Team Impact's first, and the one picked (the first until
 * staff choose). `can` is `canPostIn` or `canCreateEventIn`: membership is needed, so in practice
 * Team Impact's plus any community staff joined.
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
  return { options, chosen, choose: setCommunityId };
};

export const CommunitySelect = ({
  options,
  chosen,
  choose,
}: ReturnType<typeof useCommunityChoice>) => (
  <Select label="Community" value={chosen?.id ?? ''} onChange={(e) => choose(e.target.value)}>
    {options.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ))}
  </Select>
);
