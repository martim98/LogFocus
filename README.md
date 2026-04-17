# LogFocus

LogFocus is a local-first productivity workspace for tracking focus time, live productivity, and billable work hours.

The app exists for one main reason:

- log time while working
- measure live productivity
- track billable hours by project, task, and day
- review previous days and weeks
- keep an independent to-do list for work items that is not tied to time tracking

This README is written for the next large language model that needs to understand the codebase quickly.

## Product Idea

The creator's idea is simple:

- time spent working should be easy to record
- productivity should be visible live, not only in retrospect
- billable time should follow a clear company rule
- historical reporting should show daily and weekly evolution
- to-do planning should stay separate from time tracking

The app is not a generic task manager. It is a time-and-billing workspace first, with a separate to-do list as a secondary convenience.

## Billable Time Rule

Billable time is calculated with a specific rule:

- group sessions by the same project and the same task
- do that grouping per day
- sum raw hours inside each project/task/day bucket
- round each bucket up to the next 0.25 hour
- sum the rounded daily buckets for weekly and longer summaries

Billability exclusions and exceptions:

- `TRAINING` is excluded
- `ADMIN` is excluded unless the task is `general admin`
- project and task matching is normalized using trimmed, case-insensitive text

This rule is centralized in `lib/analytics.ts` and should not be reimplemented elsewhere.

## CSV Compatibility Requirement

The app must remain compatible with the original legacy `report.csv` format.

That means:

- the exported data must match the same column count
- the column order must stay the same
- the column names must stay the same
- the column value types must stay compatible
- the export should be consumable by the original database/import workflow

The current CSV schema is:

- `date`
- `project`
- `task`
- `hours`
- `startTime`
- `endTime`

This compatibility is important because the app is expected to export billable history in the exact same structure as the legacy `report.csv` file.

## Core Data Model

The important records live in the local store and are shared through the app API.

### `settings`

Stores the timer rules and user preferences:

- focus minutes
- daily work hours
- workweek length
- weekly billing target
- billable target rate
- auto-start focus
- sound and notification settings
- theme

### `sessions`

Stores completed or interrupted focus sessions:

- session mode
- project and task labels
- start and end timestamps
- planned and actual duration
- completion and interruption flags

Sessions are the main source of truth for productivity, history, and billing.

### `tasks`

Stores planner items:

- project label
- title
- hours
- urgency
- completion state
- ordering metadata

This is the planning surface, not the time-log surface.

### `todoItems`

Stores a completely independent to-do list:

- project
- title
- hours
- urgency
- completion state

This list does not affect session logging or billing.

## Main Code Structure

### `app/`

Next.js app routes and pages.

Important routes:

- `app/page.tsx` - the main dashboard
- `app/history/page.tsx` - session history and trends
- `app/log/page.tsx` - detailed session and billing views
- `app/settings/page.tsx` - preferences and timer setup
- `app/projects/page.tsx` - project/task workspace
- `app/todo-list/page.tsx` - independent to-do list
- `app/api/data/[resource]/route.ts` - local data API

### `components/`

UI surfaces and page sections.

Most important components:

- `components/app-shell.tsx` - app chrome and timer completion behavior
- `components/today-workspace.tsx` - main landing workspace
- `components/widgets/timer-card.tsx` - focus timer hero panel
- `components/widgets/stats-strip.tsx` - live productivity and workweek banner
- `components/billable-log-view.tsx` - daily and weekly billable reporting
- `components/settings-view.tsx` - timer and workspace settings
- `components/log-view.tsx` - history and session review
- `components/todo-list-view.tsx` - independent to-do list

### `lib/`

Domain logic, analytics, storage, and app state.

Important files:

- `lib/domain.ts` - schemas, types, and default settings
- `lib/store.ts` - client-side timer and workspace state
- `lib/analytics.ts` - productivity, billing, and trend calculations
- `lib/local-store.ts` - file-backed local persistence
- `lib/api.ts` - API client for local data access
- `lib/hooks.ts` - React hooks that read and write data

### `docs/`

Contains additional app-level documentation.

- `docs/app-model.md` explains the current data model and the separation between sessions, tasks, to-dos, and settings.

## How the App Works

### Focus tracking

The timer is focus-first.

- the main session mode is focus
- a running focus block can be started, paused, reset, or completed
- when a focus block ends, it is logged as a session
- live session data feeds the dashboard and productivity views

### Live productivity

The app computes live productivity from focus sessions:

- current work hours
- productivity score
- projected work hours
- estimated finish time

The live banner on the dashboard should stay visually light but informative, because it is a constant at-a-glance status area.

### Billable reporting

Billable summaries are used in:

- the billable log page
- the live statistics banner
- weekly pace calculations
- week-over-week trend views

The important implementation rule is that weekly billable data is derived from daily billable data, not from a separate one-pass week aggregation.

### Independent to-do list

The to-do list is intentionally separate from session and billing logic.

- it can be used to capture work items during the day
- it can be marked completed independently
- it does not change session tracking
- it does not affect billing calculations

## Key Implementation Notes

- Keep billing logic centralized in `lib/analytics.ts`
- Keep timer state centralized in `lib/store.ts`
- Keep data schemas in `lib/domain.ts`
- Keep persistence concerns in `lib/local-store.ts`
- Do not couple to-do items to session logging
- Do not duplicate exclusion rules in the UI
- Do not split weekly billing math away from daily billing math

## Local Storage and Runtime

This is a local workspace app.

- data is stored in the local file-backed store
- there is no cloud sync
- there is no account switching
- the API routes read and write the local store

## Suggested Reading Order For Another Model

If you need to understand the app quickly, read these files first:

1. `docs/app-model.md`
2. `lib/domain.ts`
3. `lib/analytics.ts`
4. `lib/store.ts`
5. `components/today-workspace.tsx`
6. `components/billable-log-view.tsx`

## What Not To Change Lightly

- the billable rounding rule
- the exclusion rule for `TRAINING` and `ADMIN`
- the separation between sessions and to-do items
- the local-first persistence model
- the live productivity calculations used by the dashboard

## Short Summary

LogFocus is a local productivity and billing app that tracks focus time, computes live productivity, and produces billable time using a day-first rounding model. It also includes an independent to-do list for work capture, but that list is intentionally separate from the hour-tracking system.
