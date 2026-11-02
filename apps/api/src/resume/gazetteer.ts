import { SPORTS, type Region } from '@team-impact/contracts';

/**
 * Word lists the heuristic reader scores against. Matching known vocabulary is the biggest
 * non-LLM accuracy gain for school, major and title (TI-155 research); these lists are short on
 * purpose and only ever add confidence, never invent a value.
 */

/** Degree tokens. A line can hold several ("B.A. Economics, B.S. Mathematics"). */
export const DEGREE =
  /\b(bachelor(?:'s)?(?: of (?:arts|science|fine arts|business administration|engineering))?|master(?:'s)?(?: of [a-z ]+?)?|associate(?:'s)?(?: of [a-z ]+?)?|doctor(?:ate)? of [a-z]+|ph\.?\s?d\.?|m\.?b\.?a\.?|b\.?\s?a\.?|b\.?\s?s\.?|b\.?\s?b\.?\s?a\.?|b\.?\s?f\.?\s?a\.?|b\.?\s?eng\.?|m\.?\s?s\.?|m\.?\s?a\.?|m\.?\s?eng\.?|a\.?\s?a\.?|a\.?\s?s\.?)(?![a-z])/gi;

const DEGREE_ONCE = new RegExp(DEGREE.source, 'i');
/** `DEGREE` is global (for `matchAll`); this one is safe to `test` repeatedly. */
export const hasDegree = (s: string) => DEGREE_ONCE.test(withoutPlaces(s));

export const isGraduateDegree = (degree: string) =>
  /master|doctor|ph\.?\s?d|m\.?b\.?a|^m\.?\s?(s|a|eng)\.?$/i.test(degree.trim());

/** Words that mark a line as a school's name. */
export const SCHOOL =
  /\b(university|college|institute|school|academy|polytechnic|conservatory|community college)\b/i;

export const HIGH_SCHOOL = /\b(high school|secondary school|prep(aratory)? school|h\.s\.)\b/i;

/** Words that mark a segment as an organisation rather than a role. */
export const ORG =
  /\b(inc|llc|ltd|corp|corporation|company|group|partners|associates|bank|capital|foundation|fund|club|society|association|council|team|athletics|department|dept|office|center|centre|lab|laboratory|hospital|clinic|university|college|school|institute|academy|agency|studio|ventures|holdings|consulting|solutions|technologies|systems|labs|union|league|federation|committee|program|camp|ymca|church|city of|state of|town of)\b\.?/i;

/** Common job and student-leadership titles (scored, not required). */
export const TITLE =
  /\b(intern|internship|analyst|associate|assistant|coordinator|manager|director|lead|leader|captain|co-captain|president|vice president|vp|treasurer|secretary|chair|chairperson|founder|co-founder|engineer|developer|designer|consultant|researcher|research assistant|teaching assistant|tutor|mentor|coach|counselor|instructor|specialist|representative|rep|officer|member|volunteer|ambassador|fellow|trainee|apprentice|clerk|cashier|server|lifeguard|staff|editor|writer|reporter|organizer|advisor|scout|student athlete|student-athlete|player|starter|delegate|liaison|administrator|supervisor|technician|operator|sales|marketing|recruiter)\b/i;

/** Two-letter states and full names → the card's region (PRD §7 search filter). */
const STATES: [string, string, Region][] = [
  ['CT', 'Connecticut', 'northeast'],
  ['ME', 'Maine', 'northeast'],
  ['MA', 'Massachusetts', 'northeast'],
  ['NH', 'New Hampshire', 'northeast'],
  ['RI', 'Rhode Island', 'northeast'],
  ['VT', 'Vermont', 'northeast'],
  ['NJ', 'New Jersey', 'northeast'],
  ['NY', 'New York', 'northeast'],
  ['PA', 'Pennsylvania', 'northeast'],
  ['IL', 'Illinois', 'midwest'],
  ['IN', 'Indiana', 'midwest'],
  ['MI', 'Michigan', 'midwest'],
  ['OH', 'Ohio', 'midwest'],
  ['WI', 'Wisconsin', 'midwest'],
  ['IA', 'Iowa', 'midwest'],
  ['KS', 'Kansas', 'midwest'],
  ['MN', 'Minnesota', 'midwest'],
  ['MO', 'Missouri', 'midwest'],
  ['NE', 'Nebraska', 'midwest'],
  ['ND', 'North Dakota', 'midwest'],
  ['SD', 'South Dakota', 'midwest'],
  ['DE', 'Delaware', 'south'],
  ['FL', 'Florida', 'south'],
  ['GA', 'Georgia', 'south'],
  ['MD', 'Maryland', 'south'],
  ['NC', 'North Carolina', 'south'],
  ['SC', 'South Carolina', 'south'],
  ['VA', 'Virginia', 'south'],
  ['DC', 'District of Columbia', 'south'],
  ['WV', 'West Virginia', 'south'],
  ['AL', 'Alabama', 'south'],
  ['KY', 'Kentucky', 'south'],
  ['MS', 'Mississippi', 'south'],
  ['TN', 'Tennessee', 'south'],
  ['AR', 'Arkansas', 'south'],
  ['LA', 'Louisiana', 'south'],
  ['OK', 'Oklahoma', 'south'],
  ['TX', 'Texas', 'south'],
  ['AZ', 'Arizona', 'west'],
  ['CO', 'Colorado', 'west'],
  ['ID', 'Idaho', 'west'],
  ['MT', 'Montana', 'west'],
  ['NV', 'Nevada', 'west'],
  ['NM', 'New Mexico', 'west'],
  ['UT', 'Utah', 'west'],
  ['WY', 'Wyoming', 'west'],
  ['AK', 'Alaska', 'west'],
  ['CA', 'California', 'west'],
  ['HI', 'Hawaii', 'west'],
  ['OR', 'Oregon', 'west'],
  ['WA', 'Washington', 'west'],
];

export const regionOfState = (state: string): Region | null => {
  const s = state.trim().replace(/\.$/, '');
  const hit = STATES.find(
    ([abbr, name]) => abbr === s.toUpperCase() || name.toLowerCase() === s.toLowerCase(),
  );
  return hit?.[2] ?? null;
};

const STATE_NAMES = STATES.map(([, name]) => name).join('|');
const STATE_ABBRS = STATES.map(([abbr]) => abbr).join('|');
/** "Boston, MA", "Austin, Texas". Only ever matched in the header, never in a job or school line. */
export const CITY_STATE = new RegExp(
  `\\b([A-Z][a-zA-Z.'-]+(?:\\s[A-Z][a-zA-Z.'-]+){0,2}),\\s*(${STATE_ABBRS}|${STATE_NAMES})\\b`,
);

const CITY_STATE_ALL = new RegExp(CITY_STATE.source, 'g');
/** "Chestnut Hill, MA" out, so a state's "MA" or "MS" is never read as a degree. */
export const withoutPlaces = (s: string) => s.replace(CITY_STATE_ALL, ' ');

/** Positions per sport word; matched only in the athletics section or a "Position:" label. */
export const POSITIONS = [
  'goalkeeper',
  'goalie',
  'defender',
  'midfielder',
  'forward',
  'striker',
  'winger',
  'center back',
  'fullback',
  'quarterback',
  'running back',
  'wide receiver',
  'tight end',
  'linebacker',
  'cornerback',
  'safety',
  'offensive lineman',
  'defensive lineman',
  'kicker',
  'punter',
  'point guard',
  'shooting guard',
  'small forward',
  'power forward',
  'center',
  'guard',
  'pitcher',
  'catcher',
  'first baseman',
  'second baseman',
  'shortstop',
  'third baseman',
  'outfielder',
  'infielder',
  'attacker',
  'attack',
  'setter',
  'libero',
  'outside hitter',
  'middle blocker',
  'opposite hitter',
  'coxswain',
  'rower',
  'sprinter',
  'distance runner',
  'thrower',
  'jumper',
  'hurdler',
  'swimmer',
  'diver',
  'wing',
  'defense',
  'goaltender',
];

export const POSITION = new RegExp(`\\b(${POSITIONS.join('|')})s?\\b`, 'i');

export const SPORT = new RegExp(
  `\\b(${SPORTS.map((s) => s.replace(/ /g, '\\s')).join('|')}|soccer|track and field|track & field|swimming|tennis|volleyball|wrestling|softball)\\b`,
  'i',
);
