-- Reverses 0001_card_experience_entries.sql. Run with `pnpm --filter @team-impact/api db:rollback`.
-- Entries go back to the v2 payload shape ({ role, org, years }). A row that held free text before
-- the migration comes back as entries in that shape, not as the original string.
CREATE FUNCTION pg_temp.ti150_experience_down(entries jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('role', x ->> 'role', 'org', x ->> 'organization', 'years', x ->> 'period')
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(entries) WITH ORDINALITY AS t(x, ord)
$$;
UPDATE "cards"
SET "payload" = jsonb_set("payload", '{experience}', pg_temp.ti150_experience_down("payload" -> 'experience'))
WHERE jsonb_typeof("payload" -> 'experience') = 'array';
UPDATE "media"
SET "parsed_payload" = jsonb_set("parsed_payload", '{experience}', pg_temp.ti150_experience_down("parsed_payload" -> 'experience'))
WHERE jsonb_typeof("parsed_payload" -> 'experience') = 'array';
DROP FUNCTION pg_temp.ti150_experience_down(jsonb);
