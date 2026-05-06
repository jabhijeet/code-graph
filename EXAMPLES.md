# Code-Graph Examples

## ThinkBeforeCoding

Weak:
- "I assumed the API can change shape, so I updated the endpoint and the frontend."

Better:
- "Assumption: response shape stays stable. If it changes, backend contract, frontend parsing, and tests all move. Clarify before editing."

## Simplicity

Weak:
- Adds helper classes, flags, and config for a one-line bug fix.

Better:
- Fixes the comparison in place. No new abstraction for single-use logic.

## SurgicalChanges

Weak:
- Bug fix also renames variables, reformats file, and removes unrelated dead code.

Better:
- Bug fix touches only required lines, then removes one import made unused by that exact change.

## GoalDriven

Weak:
- "Done. Should work now."

Better:
- "Goal: login succeeds with valid token and expired token still fails. Verify: unit test covers both cases. Result: valid path passes, expired path still rejected."
