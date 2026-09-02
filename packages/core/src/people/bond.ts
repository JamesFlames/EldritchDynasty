import type { Person } from '@ed/schema';
import type { SimCtx } from '../world.js';

/**
 * THE BOND — how this world holds a person who would rather go (world §12).
 *
 * The design says what this may and may not be, and it is worth quoting
 * because it is the whole specification:
 *
 *   *"Nobody in this world is a slave and there is no serfdom in Aubren.
 *   People are held by debt, custom, contract and having nowhere else to go,
 *   which is sufficient."*
 *
 * So there is no chattel tier here and there will not be one. What there is is
 * DEBT, and debt is sufficient: a bonded servant cannot leave for arrears,
 * cannot leave when the house is destitute, and is not released by the death
 * of the man who signed them. Everything an unfree tier does mechanically,
 * done by the one instrument the world actually has.
 *
 * `term: 'bonded'` has been in `RetainerContractS` since its first draft and
 * meant nothing: `releaseContracts` tested `seasonal`, `yearly` and
 * `hereditary` by name and a bonded contract fell through every branch as
 * though it were `lifetime`. It had no sum attached, so there was nothing for
 * it to be a bond ABOUT. `RetainerContract.debt` is that sum and this file is
 * what reads it.
 *
 * THE PRICE OF CHEAP HANDS. A bonded servant is not paid — the wage services
 * the debt instead — so `driftLoyalty` cannot buy their silence, and a bond
 * long enough to be worth taking is long enough to end in somebody who knows
 * things and is owed nothing. That is not a balance penalty bolted on. It is
 * the same trade the rest of this game makes: the cheap option is cheap now
 * and is charged for later, by a system that was already running.
 *
 * Units are MARKS, because `RetainerContract.wage` is marks a year (world §11)
 * and a debt that a wage pays down has to be in the wage's own money. The
 * treasury is in crowns; `CROWN` is the conversion and it is world §13's.
 */

/** 1 crown = 20 marks (concept §13). */
export const CROWN = 20;

/**
 * What the house may not advance beyond, in marks.
 *
 * A bond has to be payable off inside a working life or it is not a debt, it
 * is the thing world §12 says this world does not have. At a steward's 6 marks
 * a year this is a little over thirty years of service, which is long, hard,
 * and finite — and the servant who works it off walks out knowing everything.
 */
export const MAX_BOND = 200;

export function isBonded(p: Person): boolean {
  return p.contract?.term === 'bonded' && p.contract.debt > 0;
}

/** Everyone the house is currently holding by debt. */
export function bondsmen(ctx: SimCtx): Person[] {
  return ctx.world.people.living().filter(isBonded);
}

/**
 * Advance a sum against service. The house buys hands it does not have to pay
 * for, and acquires a person with a reason to resent it.
 *
 * Refuses to bond somebody already bonded rather than stacking debts: a second
 * advance against a standing bond is how a debt stops being payable, and a
 * debt that cannot be paid is the tier this world does not have.
 */
export function bindService(ctx: SimCtx, p: Person, marks: number): boolean {
  const c = p.contract;
  if (!c || isBonded(p)) return false;
  if (marks <= 0 || marks > MAX_BOND) return false;

  c.term = 'bonded';
  c.debt = marks;
  ctx.world.treasury -= marks / CROWN;
  ctx.world.chronicle.push({
    year: ctx.world.year,
    weight: 'line',
    text: `${p.name} took ${marks} marks from the house and gave the years back for it.`,
    named: false,
  });
  return true;
}

/**
 * The debt is forgiven and the bond ends.
 *
 * Distinct from being released, and that distinction is the point of the
 * `freed` branch of `onEmployerDeath`, which until now did exactly what
 * `released` did. A freed servant leaves owing nothing and does not carry the
 * grievance that drives a secret out of the house — see `walkSecrets`, whose
 * `ReleaseReason` decides how bitter the leaving was.
 *
 * The house loses the debt. That is the cost, and it is a real one: the sum is
 * an asset, and forgiving it is the kind of thing this game is about asking
 * whether a family does.
 */
export function freeBond(ctx: SimCtx, p: Person): boolean {
  const c = p.contract;
  if (!c || c.term !== 'bonded') return false;
  const forgiven = c.debt;
  c.debt = 0;
  c.term = 'yearly';
  ctx.world.chronicle.push({
    year: ctx.world.year,
    weight: 'paragraph',
    title: 'The bond',
    text: forgiven > 0
      ? `The house tore up what ${p.name} still owed — ${forgiven} marks of it — and said so where `
        + 'people could hear.'
      : `${p.name}'s bond was ended, there being nothing left on it worth the ink.`,
    named: false,
  });
  return true;
}

/**
 * A year of service against the debt.
 *
 * The wage is not paid out; it comes off what is owed. A bond therefore costs
 * the house nothing in the years it is running, which is the entire reason a
 * house would take one, and is why the cost has to sit somewhere else.
 *
 * When the last of it is worked off the bond discharges to a `yearly`
 * contract rather than ending the service. They are a servant now, on wages,
 * who spent thirty years not being paid by this family and remembers it — and
 * `releaseContracts` can let them go the next lean quarter, on the ordinary
 * terms, with everything they know.
 */
export function serviceBonds(ctx: SimCtx): Person[] {
  const discharged: Person[] = [];
  for (const p of bondsmen(ctx)) {
    const c = p.contract!;
    c.debt = Math.max(0, c.debt - c.wage);
    if (c.debt > 0) continue;

    c.term = 'yearly';
    discharged.push(p);
    ctx.world.chronicle.push({
      year: ctx.world.year,
      weight: 'line',
      text: `${p.name} finished paying the house what ${p.name} had borrowed, and stayed on for wages.`,
      named: false,
    });
  }
  return discharged;
}
