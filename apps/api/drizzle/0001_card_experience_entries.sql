-- TI-150: card experience becomes up to 3 { role, organization, period } entries (the contract's
-- ExperienceEntry), kept in the JSON payload. Free text becomes one entry per `;`-separated part,
-- with the text as the role; v2 seed rows ({ role, org, years }) are renamed. Entries without a
-- role are dropped, fields are cut to the contract's limits and only the first 3 are kept.
-- Resume drafts (media.parsed_payload) get the same shape.
-- Reversed by down/0001_card_experience_entries.sql.
CREATE FUNCTION pg_temp.ti150_experience(old jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(e ORDER BY n), '[]'::jsonb)
  FROM (
    SELECT row_number() OVER (ORDER BY kind, ord) AS n, e
    FROM (
      SELECT 1 AS kind, ord,
        jsonb_build_object('role', left(btrim(part), 60), 'organization', '', 'period', '') AS e
      FROM unnest(string_to_array(CASE WHEN jsonb_typeof(old) = 'string' THEN old #>> '{}' END, ';'))
        WITH ORDINALITY AS t(part, ord)
      WHERE btrim(part) <> ''
      UNION ALL
      SELECT 2 AS kind, ord, jsonb_build_object(
        'role', left(btrim(x ->> 'role'), 60),
        'organization', left(btrim(coalesce(x ->> 'organization', x ->> 'org', '')), 80),
        'period', left(btrim(coalesce(x ->> 'period', x ->> 'years', '')), 30)
      ) AS e
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(old) = 'array' THEN old ELSE '[]'::jsonb END)
        WITH ORDINALITY AS t(x, ord)
      WHERE jsonb_typeof(x) = 'object' AND btrim(coalesce(x ->> 'role', '')) <> ''
    ) entries
  ) numbered
  WHERE n <= 3
$$;
--> statement-breakpoint
UPDATE "cards"
SET "payload" = jsonb_set("payload", '{experience}', pg_temp.ti150_experience("payload" -> 'experience'))
WHERE "payload" ? 'experience';
--> statement-breakpoint
UPDATE "media"
SET "parsed_payload" = jsonb_set("parsed_payload", '{experience}', pg_temp.ti150_experience("parsed_payload" -> 'experience'))
WHERE jsonb_typeof("parsed_payload") = 'object' AND "parsed_payload" ? 'experience';
--> statement-breakpoint
DROP FUNCTION pg_temp.ti150_experience(jsonb);
