# Master Prompt — Armo Fantasy World Cup

Copy everything below into a new Cursor chat to continue building or maintaining this app.

---

## Project: Armo Fantasy World Cup

Build a **friends-only FIFA World Cup 2026 pick'em web app** (like NCAA March Madness brackets). ~30–50 users log in with **username + password only** (no email verification, no OAuth). They pick winners for every World Cup match, earn escalating points in later rounds, and view a live leaderboard.

### App name
**Armo Fantasy World Cup** (subtitle: JIT University World Cup — Friends Only)

### Tech stack (use exactly this)
| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** (App Router, TypeScript) |
| Styling | **Tailwind CSS v4** |
| Database + Auth | **Supabase** (Postgres + Auth) |
| Match data API | **API-Football** (api-sports.io) — `league=1`, `season=2026` |
| Hosting | **Vercel** (free tier + cron for match sync) |
| Dates | `date-fns` |

### Auth (simple, friends-only)
- Users sign up with **username + password + invite code** only.
- Internally map username → `username@armo-fantasy.local` for Supabase Auth.
- **Disable email confirmation** in Supabase Dashboard → Authentication → Providers → Email.
- Gate registration with `INVITE_CODE` env var (share only with friends).
- `robots.txt` disallows all crawlers; `noindex` meta tag on all pages.
- No CAPTCHA needed if invite code + auth-required routes are used.

### Core game rules
1. **Group stage**: Pick winner (or tie) + exact score. Correct winner = 1 pt. Exact score bonus = +5 pts. Picks lock **60 seconds before kickoff**.
2. **Knockout rounds**: Unlock **only after all group stage matches finish**. Pick winner + predicted minute of winning goal (±5 min for bonus).
3. **Escalating knockout points** (March Madness style — edit in `src/lib/scoring.ts`):
   - Round of 32: 2 pts
   - Round of 16: 4 pts
   - Quarter-finals: 8 pts
   - Semi-finals: 16 pts
   - Third place: 8 pts
   - Final: 32 pts
   - Winning goal minute bonus: +3 pts (within ±5 minutes)
4. Leaderboard columns: Rank, Player (avatar), Wins, Points, Streak.
5. Last-place player gets a **Wooden Spoon** badge (when 4+ players).

### UI reference (match these designs)
- **Standings page**: Black background, gold/pink/white hero typography, pink "MAKE YOUR PICKS" + green "VIEW STANDINGS" pill buttons, blue news ticker bar, dark standings table with pink highlight on #1.
- **Picks page**: Blue "MATCHES" header, pink "GROUP STAGE" tab, white match cards in 3-column grid, blue active pick buttons, green pick summary pills, score inputs for group stage.

### Database tables (Supabase)
- `profiles` — username, display_name, avatar_color, total_points, total_wins, current_streak
- `matches` — synced from API-Football (all 104 WC 2026 fixtures)
- `picks` — user predictions per match
- `app_settings` — knockout_unlocked, group_stage_complete, last_sync_at
- `news` — optional ticker items

SQL migration: `supabase/migrations/001_initial.sql`

### API routes
- `POST /api/auth/register` — username + password + invite code
- `POST /api/auth/login` — username + password
- `POST /api/auth/logout`
- `POST /api/picks` — save/update a pick (validates lock time + knockout unlock)
- `GET /api/cron/sync-matches` — sync fixtures from API-Football, score finished matches, unlock knockouts (protected by `CRON_SECRET`)

### API-Football integration
- Base URL: `https://v3.football.api-sports.io`
- Header: `x-apisports-key: YOUR_KEY`
- World Cup: `GET /fixtures?league=1&season=2026`
- Rounds: `GET /fixtures/rounds?league=1&season=2026`
- Events (winning goal minute): `GET /fixtures/events?fixture={id}`
- Sync via server cron every 15 min — **never call API from the browser**

### API-Football plan recommendation
| Plan | Price | Requests/day | Verdict |
|------|-------|--------------|---------|
| **Free** | $0 | 100 | OK for local dev/testing only |
| **Pro** | **$19/mo** | 7,500 | **Recommended for the tournament** |
| Ultra | $29/mo | 75,000 | Overkill for 50 friends |

**Get the Pro plan ($19/mo)** during the World Cup (June–July 2026). With a 15-min cron, you use ~100 requests/day for sync + a few hundred during live match days — well within Pro limits. Cancel after the tournament.

### Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
API_FOOTBALL_KEY=
INVITE_CODE=WC26
CRON_SECRET=<random-long-string>
```

### Setup steps
1. `cd armo-fantasy-wc && npm install`
2. Copy `.env.example` → `.env.local` and fill in keys
3. Create Supabase project → run `supabase/migrations/001_initial.sql` in SQL Editor
4. Supabase Auth → disable email confirmation
5. Sign up at api-football.com → get API key → subscribe to **Pro** before June 2026
6. `npm run dev` → register with invite code → test picks
7. Deploy to Vercel → add env vars → cron runs automatically via `vercel.json`
8. Manually trigger first sync: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/sync-matches`

### Pages
- `/` — Hero + news ticker + standings (requires login)
- `/picks` — Group stage + knockout match cards
- `/login` — Username/password login
- `/register` — Username/password + invite code signup

### What to build next (if continuing)
- [ ] User sends custom point system → update `src/lib/scoring.ts`
- [ ] Admin page to post news ticker items
- [ ] "My picks" summary page showing points per match
- [ ] Mobile responsive polish
- [ ] Seed demo matches for offline dev when API key isn't set

### Constraints
- Keep it simple — this is a fun friends league, not a production SaaS
- No email auth, no social login, no payments
- All match data fetched server-side only
- Minimize API calls via cron caching

---

**When I send my custom point system, update `src/lib/scoring.ts` and recalculate any already-scored picks.**
