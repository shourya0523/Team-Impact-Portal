import { useWorld } from '../../shared/store';
import { Pill, Switch } from '../../shared/ui';
import { Box, H2, PageHead } from '../kit';
import { useStaff } from '../state';

export function Groups() {
  const { world, update } = useWorld();
  const { toast } = useStaff();
  const on = world.identitySearchOn;

  const toggleOfficial = (id: string) => {
    const g = world.groups.find((x) => x.id === id);
    if (!g) return;
    update((w) => ({
      ...w,
      groups: w.groups.map((x) => (x.id === id ? { ...x, official: !x.official } : x)),
    }));
    toast(
      g.official
        ? `${g.name} is no longer official. Its recruiter filter is gone.`
        : `${g.name} is official. Members who opt in can be found by it.`,
    );
  };
  const setFlag = (v: boolean) => {
    update((w) => ({ ...w, identitySearchOn: v }));
    toast(v ? 'Identity search is on for recruiters' : 'Identity search is off everywhere');
  };

  return (
    <>
      <PageHead title="Affinity groups" />
      <section className="panel row g16" style={{ padding: 18, alignItems: 'flex-start' }}>
        <div className="stack g6 grow">
          <div id="flag-title" style={{ fontSize: 17, fontWeight: 600 }}>
            Identity search for recruiters
          </div>
          <div className="small">
            Official groups appear as a recruiter filter for members who opt in. Turning this off
            hides the filter everywhere at once. Every identity search is logged with the
            recruiter’s name.
          </div>
          {!on && (
            <div className="notice-warn" role="status" style={{ marginTop: 4 }}>
              Off. Recruiters can’t filter by any group right now. Group pages still work for
              members.
            </div>
          )}
        </div>
        <Switch checked={on} onChange={setFlag} label="Identity search for recruiters" />
      </section>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Group</th>
              <th>Created by</th>
              <th>Members</th>
              <th>Searchable</th>
              <th>Official</th>
            </tr>
          </thead>
          <tbody>
            {world.groups.map((g) => (
              <tr key={g.id}>
                <td style={{ fontWeight: 600 }}>{g.name}</td>
                <td className="small">{g.createdBy}</td>
                <td>{g.members}</td>
                <td>
                  {!g.official ? (
                    '—'
                  ) : on ? (
                    `${g.searchableOptIns} opted in`
                  ) : (
                    <span className="tiny">Hidden (search off)</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    aria-pressed={g.official}
                    onClick={() => toggleOfficial(g.id)}
                    className={'btn btn-sm ' + (g.official ? 'btn-navy' : 'btn-outline')}
                  >
                    {g.official ? 'Official' : 'Mark official'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Box>
        <div className="row between wrap g8">
          <H2>Identity search log</H2>
          <Pill tone={on ? 'ok' : 'gray'}>{on ? 'Search on' : 'Search off'}</Pill>
        </div>
        {world.searchLog.length === 0 ? (
          <div className="small">
            No identity searches yet. When a recruiter filters by a group, it shows up here with
            their name, the search and the time.
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="t" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Search</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {[...world.searchLog].reverse().map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{s.who}</td>
                    <td>{s.query}</td>
                    <td className="small">{s.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Box>
    </>
  );
}
