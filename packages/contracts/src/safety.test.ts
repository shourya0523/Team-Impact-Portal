import { describe, expect, it } from 'vitest';
import { CreateReportRequest, ListEntryParams, MyReport, SetListNoteRequest } from './index';

const ID = '00000000-0000-4000-8000-000000000103';

describe('safety', () => {
  it('reports any post, comment, event, profile or community, with a known reason', () => {
    for (const kind of ['post', 'comment', 'event', 'profile', 'community'] as const) {
      expect(
        CreateReportRequest.safeParse({ target: { kind, id: ID }, reason: 'spam' }).success,
      ).toBe(true);
    }
    expect(
      CreateReportRequest.safeParse({ target: { kind: 'card', id: ID }, reason: 'spam' }).success,
    ).toBe(false);
    expect(
      CreateReportRequest.safeParse({ target: { kind: 'post', id: ID }, reason: 'rude' }).success,
    ).toBe(false);
  });

  it('caps report notes', () => {
    expect(
      CreateReportRequest.safeParse({
        target: { kind: 'post', id: ID },
        reason: 'other',
        note: 'x'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('shows a reporter their report without who else reported it', () => {
    const shape = Object.keys(MyReport.shape);
    expect(shape).not.toContain('reportCount');
    expect(shape).not.toContain('reporter');
  });

  it('needs a real note, and a real id for a list entry', () => {
    expect(SetListNoteRequest.safeParse({ text: '   ' }).success).toBe(false);
    expect(ListEntryParams.safeParse({ id: ID, entryId: 'riley' }).success).toBe(false);
  });
});
