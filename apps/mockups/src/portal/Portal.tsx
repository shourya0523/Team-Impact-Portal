import { useState } from 'react';
import { useNav, useWorld } from '../shared/store';
import { useToast } from '../shared/ui';
import { SuspendedBanner, TopNav } from './chrome';
import type { PortalProps } from './ctx';
import {
  EMPTY,
  SAM,
  SEED_SEARCHES,
  activeGroups,
  checkEmail,
  describeFilters,
  stamp,
  type Account,
  type Filters,
  type SavedSearch,
  type Screen,
} from './logic';
import Athlete from './screens/Athlete';
import { Signup, Verify, type SignupDraft } from './screens/Auth';
import JobMatch from './screens/JobMatch';
import { ListDetail, Lists } from './screens/Lists';
import Opportunity from './screens/Opportunity';
import Saved from './screens/Saved';
import Search from './screens/Search';

const START_DRAFT: SignupDraft = {
  name: SAM.name,
  title: SAM.title,
  email: SAM.email,
  password: 'password123',
  terms: true,
};

export default function Portal() {
  const { world, update } = useWorld();
  const nav = useNav<Screen>('signup');
  const [toast, showToast] = useToast(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [draft, setDraft] = useState<SignupDraft>(START_DRAFT);
  const [filters, setFiltersRaw] = useState<Filters>(EMPTY);
  const [searches, setSearches] = useState<SavedSearch[]>(SEED_SEARCHES);

  const signIn = (a: Account) => {
    setAccount(a);
    nav.reset('search');
  };

  if (!account || nav.screen === 'signup' || nav.screen === 'verify') {
    return (
      <div style={{ background: 'var(--ground)' }}>
        {nav.screen === 'verify' ? (
          <Verify
            email={draft.email}
            toast={showToast}
            onChange={() => nav.back()}
            onOpen={() => {
              const c = checkEmail(world, draft.email);
              if (c.kind !== 'ok') return;
              signIn({
                name: draft.name.trim(),
                title: draft.title.trim(),
                email: draft.email.trim().toLowerCase(),
                companyId: c.company.id,
              });
              showToast(
                `Welcome, ${draft.name.trim().split(' ')[0]}. You're in ${c.company.name}'s account.`,
              );
            }}
          />
        ) : (
          <Signup
            draft={draft}
            setDraft={setDraft}
            onCreated={() => nav.go('verify')}
            onSignIn={() => {
              signIn(SAM);
              showToast('Signed in as Sam Park');
            }}
          />
        )}
        {toast}
      </div>
    );
  }

  const company = world.companies.find((c) => c.id === account.companyId) ?? {
    id: account.companyId,
    name: 'Your company',
    domains: [account.email.split('@')[1] ?? ''],
    recruiters: 1,
    status: 'suspended' as const,
    since: '',
  };
  const suspended = company.status !== 'active';
  const who = `${account.name} · ${company.name.split(' ')[0]}`;

  // Every search that uses an identity (affinity-group) filter is logged to the shared world.
  const setFilters = (f: Filters) => {
    setFiltersRaw(f);
    if (activeGroups(world, f).length) {
      update((w) => ({
        ...w,
        searchLog: [...w.searchLog, { who, query: describeFilters(w, f), when: stamp() }],
      }));
    }
  };

  const props: PortalProps = {
    account,
    company,
    suspended,
    params: nav.params,
    go: nav.go,
    reset: nav.reset,
    back: nav.back,
    canGoBack: nav.canGoBack,
    toast: showToast,
    filters,
    setFilters,
    searches,
    setSearches: (fn) => setSearches(fn),
    who,
  };

  const body = (() => {
    switch (nav.screen) {
      case 'athlete':
        return <Athlete key={nav.params.id} {...props} />;
      case 'lists':
        return <Lists {...props} />;
      case 'list':
        return <ListDetail key={nav.params.id} {...props} />;
      case 'saved':
        return <Saved {...props} />;
      case 'jd':
        return <JobMatch {...props} />;
      case 'post':
        return <Opportunity {...props} />;
      default:
        return <Search {...props} />;
    }
  })();

  return (
    <div style={{ background: 'var(--ground)', minHeight: 'calc(100vh - 44px)' }}>
      <TopNav
        screen={nav.screen}
        account={account}
        companyName={company.name}
        onNav={(s) => nav.reset(s)}
        onSignOut={() => {
          setAccount(null);
          setFiltersRaw(EMPTY);
          setDraft(START_DRAFT);
          nav.reset('signup');
          showToast('Signed out');
        }}
      />
      <main
        className="container screen"
        key={nav.screen + (nav.params.id ?? '')}
        style={{ maxWidth: 1440 }}
      >
        {suspended && <SuspendedBanner companyName={company.name} />}
        {body}
      </main>
      {toast}
    </div>
  );
}
