# Supabase row limit (1,000 rows)

## The rule

**Supabase / PostgREST returns at most 1,000 rows per query** unless you paginate with `.range(from, to)`.

If you `select` from `picks` (or any large table) without pagination, you only get the **first 1,000 rows**. Any code that aggregates, scores, or reports on “all picks” will be **wrong** once you pass that count.

As of group stage + knockout brackets, this pool has **3,000+ picks** across **46 users**. Missing rows affects **everyone**, not one player — e.g. kevin’s knockout picks were omitted from reports because they were not in the first 1,000 rows.

## When you MUST paginate

Paginate any query that can return **more than 1,000 rows total**:

| Table | Risk |
|-------|------|
| `picks` | **High** — grows with users × matches (group + knockout) |
| `bracket_slot_picks` | Medium — users × later-round slots |
| `profiles` | Low now (~50) — paginate if user count grows |
| `matches` | Low (~100) |

**Safe without pagination:** queries filtered to a **single user** (one account’s picks are usually &lt; 100 rows).

## How to paginate

### App code (TypeScript)

Use `src/lib/supabase/paginate.ts`:

```typescript
import { fetchAllPages, fetchAllTableRows } from "@/lib/supabase/paginate";

// Whole table
const picks = await fetchAllTableRows<Pick>(supabase, "picks", "*", "id");

// Filtered query — paginate inside the loop
const picks = await fetchAllPages<Pick>((from, to) =>
  supabase
    .from("picks")
    .select("*")
    .in("match_id", matchIds)
    .order("id", { ascending: true })
    .range(from, to)
);
```

### Ops scripts (`.mjs`)

Use `scripts/lib/supabase-paginate.mjs`:

```javascript
import { fetchAllPages, fetchAllTableRows } from "./lib/supabase-paginate.mjs";

const picks = await fetchAllTableRows(sb, "picks", "user_id, match_id", "id");
```

Always add a **stable `.order()`** on the same column when paginating filtered queries so pages do not shift between requests.

## Review checklist

Before merging code that reads from Supabase, ask:

1. Can this query return **more than 1,000 rows**?
2. If yes, does it use `fetchAllPages` / `fetchAllTableRows` (or equivalent `.range()` loop)?
3. For `.in("user_id", manyIds)` batches, can the batch still exceed 1,000 rows? If yes, paginate **inside** each batch.

## Places that already paginate

- `src/lib/supabase/paginate.ts` — shared helper
- `src/lib/match-pick-details.ts` — Games pick details
- `src/app/api/cron/sync-matches/route.ts` — full leaderboard rebuild
- `src/lib/score-finished-picks.ts` — scoring unscored / finished picks
- `src/lib/migrate-bracket-slot-picks.ts` — cron slot migration
- `scripts/knockout-bracket-completion-report.mjs`
- `scripts/pick-completion-report.mjs`
- `scripts/rebuild-profiles-from-picks.mjs`
- `scripts/count-picks.mjs`

## Verify pick count

```bash
node scripts/count-picks.mjs
```

If `fetched picks` is **less than** `pick count`, something is still not paginating.

## Reports

```bash
node scripts/knockout-bracket-completion-report.mjs
node scripts/pick-completion-report.mjs
```

Both require paginated `picks` or results will under-count completed brackets.
