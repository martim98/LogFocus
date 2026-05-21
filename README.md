# LogFocus

LogFocus is a local-first workspace for focus tracking, live productivity, billable-hour pacing, CSV export, and a separate to-do list. It is a time-and-billing app first; planner and to-do surfaces support that workflow but must not silently change billing math.

## Run

- `npm run dev` starts the Next.js app.
- `npm test` runs the regression suite.
- `npm run lint` runs ESLint.
- `npm run build` creates the production build.
- `npm run start` serves an existing production build.

## Routes

- `/` is the main timer workspace.
- `/log` is session history, editing, productivity charts, and export.
- `/billable-log` is billing calendar, pace, and rolling billable trend.
- `/todo-list` is a planning-label work queue. To-do labels support time review but do not replace PSA/timer task categories.
- `/projects` and `/settings` are supporting workspaces.
- `/history`, `/capture`, and `/login` are compatibility redirects, not full feature pages.
- `/api/data/[resource]` is the local data API.

Trend plots on `/log` and `/billable-log` omit the current day so partial-day data does not distort charts.

## Data Model

Persistent records live in the local file-backed store behind the API route:

- `settings`: timer lengths, billing schedule, reward targets, sound, coach, ntfy, and alert preferences.
- `projects`: project labels used for task/session grouping.
- `tasks`: planner rows; session logging does not mutate them.
- `todoItems`: independent planning labels; they do not affect billing or PSA timer task categories.
- `sessions`: completed/interrupted focus sessions; these are the source of truth for productivity and billing.
- `plans` and `focusRewards`: planning/reward state used by the UI and reward ledger.

There is no runtime Clerk/Supabase login or cloud sync path in the current app.

## Billing Rules

Billing behavior is centralized in `lib/analytics.ts`.

- Group focus sessions by day, project, and task.
- Sum raw hours inside each bucket.
- Round each bucket up to the next quarter hour.
- Sum rounded buckets for day/week/calendar views.
- `TRAINING` is non-billable.
- `ADMIN` is billable only when the task is `general admin`.
- Other `ADMIN` tasks are non-billable.
- All other project/task combinations are billable.
- Matching is trimmed and case-insensitive.

Do not reimplement these rules in components. Add characterization tests before changing anything that touches billing, productivity, rewards, or exports.

## CSV Compatibility

CSV export must keep the legacy column shape:

`date,project,task,hours,startTime,endTime`

Raw export stays one row per focus session. Grouped export stays grouped by day/project/task and uses quarter-hour rounded bucket hours. Do not rename, reorder, or remove columns.

## Code Map

- `lib/domain.ts`: active schemas, types, and defaults.
- `lib/analytics.ts`: productivity, billing, session indexes, coach inputs, and trends.
- `lib/report-export.ts`: CSV builders.
- `lib/focus-rewards.ts`: reward ledger math.
- `lib/store.ts` and `lib/workspace-store.ts`: client state and resource writes.
- `components/widgets/stats-strip.tsx`: live dashboard, coach, alerts, ntfy/audio dispatch.
- `components/widgets/timer-card.tsx`: timer controls.
- `components/log-view.tsx` and `components/billable-log-view.tsx`: history and billing views.

Read `docs/app-model.md` before making calculation or persistence changes.

## Safe Change Checklist

- Commit any existing user work before refactoring.
- Do not edit `supabase/migrations/*` unless the task explicitly requires a database migration.
- Do not change persisted schema/API/CSV shapes unless the task explicitly requires it.
- Preserve `ADMIN/general admin` as billable.
- Run `npm test` and `npm run lint`.
- For analytics refactors, benchmark representative session counts and compare outputs against characterization tests.
