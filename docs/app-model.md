# LogFocus App Model

## Tables

### `settings`
- Single persisted preference record for the local workspace.
- Stores timer rules, productivity targets, billable thresholds, theme, sound, and notification preferences.
- The settings page reads and writes this record directly, and dashboard calculations read from it as the source of truth.

### `tasks`
- Planner surface for editable work items.
- Stores the task title, free-text project label, urgency, hours, completion state, and ordering metadata.
- The planner in the app reads and writes this table directly.

### `todoItems`
- Independent to-do log surface.
- Stores project, task name, hours, urgency, completion state, and editable metadata.
- The to-do list page reads and writes this table directly and does not link it to session logging.

### `sessions`
- Independent session log.
- Stores completed or interrupted work sessions with timestamps and duration.
- Session logging does not mutate task rows.

## Rules

- The planner is the only place where task rows are created, edited, completed, or deleted.
- Pomodoro and session flows must not create or update planner tasks.
- `tasks` and `sessions` are separate concerns and are not linked through application logic.
- `todoItems` is separate from both `tasks` and `sessions` and has no linkage to either flow.
- No third table is used for planner data.
- The app now runs as a single local workspace with no login screen and no cloud sync.
- Persistent data lives in the local file-backed store used by the Next.js API routes.
- CSV export keeps the same column order and date/time formatting as the previous version.

## Planner Fields

- `project`: free-text label for grouping tasks in the planner UI.
- `title`: task name shown to the user.
- `urgency`: numeric ranking used for planner ordering and risk cues.
- `hours`: estimated work hours for the task.
- `completed`: boolean completion state controlled from the to-do actions.
- `status`: `todo` or `done`.

## Compatibility Notes

- Legacy timer fields can remain in the database for backward compatibility, but the planner does not depend on them.
- Existing session behavior should stay unchanged.
