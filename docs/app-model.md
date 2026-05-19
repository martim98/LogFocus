# LogFocus App Model

This document is the source of truth for future code changes. Keep it accurate when behavior changes.

## Persistence And API

LogFocus is a single local workspace. Data is read and written through `app/api/data/[resource]/route.ts`, backed by the file store in `lib/local-store.ts`.

Active persisted resources are `settings`, `projects`, `tasks`, `todoItems`, `plans`, `sessions`, and `focusRewards`. Redirect pages such as `/history`, `/capture`, and `/login` exist for compatibility only.

Do not change persisted JSON shapes, API resource names, or migration files during refactors.

## Data Boundaries

- `sessions` are the source of truth for logged focus, productivity, billing, charts, CSV, and reward derivation.
- `tasks` are planner rows. Timer/session flows may reference a task id/name but must not create or mutate planner rows implicitly.
- `todoItems` are an independent checklist. They may label timer work but do not alter task analytics or billing.
- `settings` drive timer duration, billing schedule, billable target rate, raw-to-rounded rate, reward target, coach alerts, audio, and ntfy options.
- `focusRewards` stores explicit reward ledger adjustments; derived reward balance still comes from session history.

## Billing And Productivity

Billing is day-first and bucket-first:

- Build day/project/task buckets from focus sessions.
- Round each bucket up to `0.25h`.
- Sum rounded buckets for day/week/calendar summaries.
- Resolve missing project names from project ids when a project list is available.

Billable classification is exact:

- `TRAINING` is non-billable.
- `ADMIN` with task `general admin` is billable.
- `ADMIN` with any other task is non-billable.
- Everything else is billable.
- Text matching is trimmed and case-insensitive.

The billing calendar uses the Saturday-start visible billing week. Monday-start workweek carry-in helpers are separate compatibility calculations and should not be merged into the billing calendar.

Live productivity uses target-bounded scoring for the dashboard: once the raw focus target is reached, the live score freezes at the point the target was reached instead of decaying later in the day.

## Exports, Rewards, And Coach

- Raw CSV export keeps one row per completed focus session.
- Grouped CSV export keeps the legacy `date,project,task,hours,startTime,endTime` shape and groups by day/project/task.
- Focus rewards award, edit, and delete by session id. Deleting a rewarded session must subtract safely and never double-apply.
- Coach, sound, and ntfy dispatch are side effects around analytics output. They must not change analytics calculations.

## Refactor Rules

- Add characterization tests before changing analytics, export, reward, or coach logic.
- Keep exported function signatures stable unless the caller changes are part of the same task.
- Prefer extending the session analytics index over adding repeated full-session scans.
- Remove only code proven unused by search and tests.
- Run `npm test`, `npm run lint`, and a representative benchmark after optimization work.
