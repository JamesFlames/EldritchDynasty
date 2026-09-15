# Eldritch Dynasty interface patterns

## Reading the household

- **Direction:** a sober household ledger on vellum. The player reads the
  consequence of a year after advancing the clock; the screen should feel like
  finding a marginal note in the family account, not receiving a notification.
- **Depth:** borders-only panels. Keep the passage log flat and reserve surface
  changes for selection, never for a death or an alert.
- **Tokens:** use `--vellum`, `--vellum-deep`, `--ink`, `--ink-soft`,
  `--ink-faint`, `--rubric`, and `--rule`; do not add a danger palette. The
  rubric is an archival label, not an alarm.
- **Density:** 4px rhythm within a passage item; primary report first, then a
  2px-separated supporting line. `--t-fine` carries ledger entries and their
  notes, with weight and ink hierarchy doing the work rather than larger type.

### Cast-to-passage echo

When a person previously foregrounded by the derived cast dies, retain the
ordinary non-interactive death report in primary ink. Under it, echo the exact
engine-authored cast label in rubric and its `because` sentence in soft ink.
This is a reading of the prior snapshot, not a new person record, save field,
or client-authored epitaph. It makes a loss legible without changing the
passage log into a chronicle, alert feed, card, badge, or modal.

Use the pattern for irreversible household consequences that a prior interface
state specifically asked the player to notice. Do not use it for routine births,
study completions, or selectable rows.
