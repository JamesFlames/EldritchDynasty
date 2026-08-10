/**
 * THE COMPILER AS THE CHECKLIST.
 *
 * The verbs of this game are closed unions — `Effect`, `Condition`, `Filter`,
 * `Target`, `SlotRole` — and adding one is meant to be a deliberate act with a
 * compiler error at every site that has to keep up (AGENTS.md, invariant 5).
 *
 * That only holds if the sites are exhaustive. They were not. A `switch` with
 * no default and a chain of `if ('x' in c)` ending in `return true` both accept
 * a new variant silently: the effect applies nothing, the condition passes, and
 * the event fires anyway. That is the exact bug class invariant 11 is about —
 * a declared field that nothing reads, discovered a hundred years of simulated
 * time later, if at all.
 *
 * Ending each of those sites with `assertNever` moves the discovery to `tsc`.
 * The runtime throw is the belt to that braces: content is schema-validated, so
 * reaching it means the code and the union have genuinely diverged, and the
 * error names the value.
 */
export function assertNever(value: never, what = 'value'): never {
  throw new Error(`unhandled ${what}: ${JSON.stringify(value)}`);
}
