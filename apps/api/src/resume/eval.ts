import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { UpdateCardRequest } from '@team-impact/contracts';
import { loadEnv } from '../env';
import { readResume, resumeConfigFromEnv } from './index';
import { scoreReading, SCORED_FIELDS, summarize, type Outcome, type ResumeScore } from './score';
import { CORPUS } from './test/corpus';

/**
 * Accuracy report for the resume reader, in the TI-139 spike's format so results compare:
 *
 *   pnpm --filter @team-impact/api resume:eval --corpus        # the synthetic test resumes
 *   pnpm --filter @team-impact/api resume:eval ~/resumes        # real ones, kept on your machine
 *
 * A folder holds resume files (.pdf .jpg .png .heic), each with `<name>.gold.json`: the card
 * fields a careful reader would fill in (UpdateCardRequest shape). Real resumes are personal data:
 * use them with permission, never commit them, and delete them after (TI-139 rule). The reader
 * settings come from the environment (RESUME_LLM, DOCLING_URL), so the same run can compare the
 * layout reader alone against layout + LLM.
 */

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
};
const MARK: Record<Outcome, string> = {
  correct: '✅',
  missing: '⬜',
  wrong: '❌',
  extra: '➕',
  absent: 'N/A',
};

interface Sample {
  name: string;
  bytes: Uint8Array;
  mimeType: string;
  gold: UpdateCardRequest;
}

const fromFolder = async (dir: string): Promise<Sample[]> => {
  const files = await readdir(dir);
  const samples: Sample[] = [];
  for (const file of files.sort()) {
    const mimeType = MIME[extname(file).toLowerCase()];
    if (!mimeType) continue;
    const base = file.slice(0, -extname(file).length);
    const goldPath = join(dir, `${base}.gold.json`);
    const gold = UpdateCardRequest.parse(JSON.parse(await readFile(goldPath, 'utf8')));
    samples.push({ name: base, bytes: await readFile(join(dir, file)), mimeType, gold });
  }
  return samples;
};

const fromCorpus = async (): Promise<Sample[]> =>
  Promise.all(
    CORPUS.map(async (c) => ({
      name: c.name,
      bytes: await c.pdf(),
      mimeType: 'application/pdf',
      gold: c.gold,
    })),
  );

const main = async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: resume:eval <folder> | --corpus');
    process.exit(1);
  }
  const env = loadEnv({ ...process.env, MOCK_API: 'true' });
  const config = resumeConfigFromEnv(env);
  const samples = arg === '--corpus' ? await fromCorpus() : await fromFolder(arg);
  console.log(
    `Reader: layout${config.docling ? ' + OCR' : ''}${config.llm ? ` + ${config.llm.model}` : ''} · ${samples.length} resumes\n`,
  );
  console.log(`| Resume | ${SCORED_FIELDS.join(' | ')} | Experience | Check | ms |`);
  console.log(`| --- |${' --- |'.repeat(SCORED_FIELDS.length + 3)}`);
  const scores: ResumeScore[] = [];
  const times: number[] = [];
  for (const s of samples) {
    const started = performance.now();
    const reading = await readResume({ bytes: s.bytes, mimeType: s.mimeType, fileName: s.name });
    const ms = Math.round(performance.now() - started);
    times.push(ms);
    const score = scoreReading(reading.fields, s.gold);
    scores.push(score);
    const e = score.experience;
    const want = s.gold.experience?.length ?? 0;
    const exp = `${e.correct}/${want} ✅${e.wrong ? `, ${e.wrong} ❌` : ''}${e.missing ? `, ${e.missing} ⬜` : ''}${e.extra ? `, ${e.extra} ➕` : ''}`;
    const failed = reading.failed ? ` (failed: ${reading.reason})` : '';
    console.log(
      `| ${s.name}${failed} | ${SCORED_FIELDS.map((k) => MARK[score.fields[k]]).join(' | ')} | ${exp} | ${reading.check.join(', ')} | ${ms} |`,
    );
  }
  const sum = summarize(scores);
  const pct = (c: number, n: number) =>
    n === 0 ? 'n/a' : `${c}/${n} (${Math.round((c / n) * 100)}%)`;
  console.log(
    '\n| Field | Accuracy | ❌ wrong | ⬜ missing | ➕ extra |\n| --- | --- | --- | --- | --- |',
  );
  for (const k of SCORED_FIELDS) {
    const f = sum.fields[k];
    console.log(`| ${k} | ${pct(f.correct, f.present)} | ${f.wrong} | ${f.missing} | ${f.extra} |`);
  }
  const x = sum.experience;
  console.log(
    `| experience (entries) | ${pct(x.correct, x.present)} | ${x.wrong} | ${x.missing} | ${x.extra} |`,
  );
  const sorted = [...times].sort((a, b) => a - b);
  console.log(
    `\nMedian ${sorted[Math.floor(sorted.length / 2)] ?? 0} ms · slowest ${sorted.at(-1) ?? 0} ms`,
  );
};

await main();
