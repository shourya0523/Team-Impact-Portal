import type { Company } from '../shared/data';
import type { Account, Filters, SavedSearch, Screen } from './logic';

/** Everything a signed-in screen needs from the shell. */
export type PortalProps = {
  account: Account;
  company: Company;
  suspended: boolean;
  params: Record<string, string>;
  go: (s: Screen, params?: Record<string, string>) => void;
  reset: (s: Screen, params?: Record<string, string>) => void;
  back: () => void;
  canGoBack: boolean;
  toast: (msg: string) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  searches: SavedSearch[];
  setSearches: (fn: (s: SavedSearch[]) => SavedSearch[]) => void;
  who: string;
};
