-- Pilot completion rate and time to first card, from events_log.
--
-- Cohort: everyone whose account was created as an athlete (current or alumni), the roles that
-- have a Baseball Card. Completed: they published a card at least once. Time to first card runs
-- from sign-up to their first card.published. Set the window in `pilot` to the pilot's dates; as
-- written it covers all time. Paste into psql or a Metabase native query.
with pilot as (
  select '-infinity'::timestamptz as starts_at, 'infinity'::timestamptz as ends_at
),
athletes as (
  select e.user_id, min(e.occurred_at) as signed_up_at
  from events_log e
  cross join pilot
  where e.event = 'user.signed_up'
    and e.properties ->> 'role' in ('athlete', 'alumni_athlete')
    and e.occurred_at >= pilot.starts_at
    and e.occurred_at < pilot.ends_at
  group by e.user_id
),
first_cards as (
  select a.user_id, min(e.occurred_at) - a.signed_up_at as time_to_first_card
  from athletes a
  left join events_log e on e.user_id = a.user_id and e.event = 'card.published'
  group by a.user_id, a.signed_up_at
)
select
  count(*) as athletes,
  count(time_to_first_card) as completed,
  round(count(time_to_first_card)::numeric / nullif(count(*), 0), 3) as completion_rate,
  round(
    (extract(epoch from percentile_cont(0.5) within group (order by time_to_first_card)) / 3600)::numeric,
    1
  ) as median_hours_to_first_card,
  round(
    (extract(epoch from percentile_cont(0.9) within group (order by time_to_first_card)) / 3600)::numeric,
    1
  ) as p90_hours_to_first_card
from first_cards;
