import { MAIN_BRANCH, type CampaignId, type HouseAmbitionId } from '@ed/schema';
import type { SimCtx } from './world.js';
import { halls } from './people/branches.js';
import { measureAscension, rungTitle } from './ascension.js';
import { campaignDef } from './campaign.js';

export type AmbitionSurface = 'match' | 'table' | 'record' | 'ladder';
export interface AmbitionRelevance {
  surface: AmbitionSurface;
  effect: 'advance' | 'endanger';
  reason: string;
}
export interface HouseAmbitionView {
  id: HouseAmbitionId;
  name: string;
  purpose: string;
  progress: { current: number; target: number; label: string };
  status: string;
  next: string;
  relevance: AmbitionRelevance[];
}
export interface HouseAmbitionOption {
  id: HouseAmbitionId;
  name: string;
  purpose: string;
  campaigns: readonly CampaignId[];
}

const BOTH: readonly CampaignId[] = ['short', 'long'];

export const HOUSE_AMBITIONS: readonly HouseAmbitionOption[] = [
  { id: 'deepen_blood', name: 'Deepen the blood', purpose: 'Keep a broad living bloodline from thinning away.', campaigns: BOTH },
  { id: 'raise_ascendant', name: 'Prepare the ascent', purpose: 'Build a named line toward the next serious Ascension rung.', campaigns: BOTH },
  { id: 'restore_ledger', name: 'Restore the Ledger', purpose: 'Recover the clauses this campaign can still bring home.', campaigns: BOTH },
  { id: 'secure_branches', name: 'Secure the branches', purpose: 'Keep more than the seat alive as viable family halls.', campaigns: BOTH },
];

export function ambitionOptions(campaign: CampaignId): HouseAmbitionOption[] {
  return HOUSE_AMBITIONS.filter((a) => a.campaigns.includes(campaign)).map((a) => ({ ...a, campaigns: [...a.campaigns] }));
}

export function ambitionView(ctx: SimCtx): HouseAmbitionView | undefined {
  const id = ctx.world.houseAmbition;
  if (!id) return undefined;
  const def = HOUSE_AMBITIONS.find((a) => a.id === id);
  if (!def || !def.campaigns.includes(ctx.world.campaign)) return undefined;

  const w = ctx.world;
  if (id === 'restore_ledger') {
    const target = campaignDef(w.campaign).clauses;
    const current = Math.min(w.clausesRecovered.size, target);
    return {
      ...def,
      progress: { current, target, label: `${current} of ${target} clauses recovered` },
      status: current >= target ? 'The campaign’s recoverable Ledger is whole.' : `${target - current} clause${target - current === 1 ? '' : 's'} still missing.`,
      next: 'Follow choices that expose, preserve, or honestly record Ledger evidence.',
      relevance: [
        { surface: 'record', effect: 'advance', reason: 'A truthful page can preserve evidence the final reading will need.' },
        { surface: 'record', effect: 'endanger', reason: 'Omitting or enlarging the wrong page can make recovered truth harder to substantiate.' },
      ],
    };
  }

  if (id === 'secure_branches') {
    const viable = [...halls(w, w.year)].filter(([hall, people]) => hall !== MAIN_BRANCH && people.length >= 2).length;
    const target = w.campaign === 'short' ? 1 : 2;
    return {
      ...def,
      progress: { current: viable, target, label: `${viable} of ${target} viable cadet halls` },
      status: viable >= target ? 'The line has somewhere else to continue.' : 'The seat is carrying too much of the family alone.',
      next: 'Protect cadet households and avoid spending every useful marriage on the seat.',
      relevance: [
        { surface: 'match', effect: 'advance', reason: 'A marriage can found or strengthen the household that keeps a cadet hall viable.' },
        { surface: 'table', effect: 'advance', reason: 'Marriage policy, withholding, and branch endowments decide whether cadet halls can persist.' },
      ],
    };
  }

  if (id === 'deepen_blood') {
    const livingBlood = w.people.living().filter((p) => p.houseOfOrigin === w.playerHouse).length;
    const target = w.campaign === 'short' ? 10 : 14;
    return {
      ...def,
      progress: { current: livingBlood, target, label: `${livingBlood} living of the blood; ${target} is a resilient line` },
      status: livingBlood >= target ? 'The bloodline has room to survive a bad generation.' : 'The living blood is still narrow enough that one loss can matter.',
      next: 'Use marriages and standing orders to keep useful blood in the family without collapsing it into one household.',
      relevance: [
        { surface: 'match', effect: 'advance', reason: 'Every marriage decides whether blood stays in the line, leaves it, or becomes too closely folded.' },
        { surface: 'table', effect: 'advance', reason: 'Marriage policy and withholding shape the bloodline across the marriages the player never sees individually.' },
      ],
    };
  }

  const measured = measureAscension(ctx);
  const rungOrder = ['none', 'touched', 'adept', 'hierophant', 'vessel', 'demigod', 'god'] as const;
  const targetRung = w.campaign === 'short' ? 'hierophant' : 'god';
  const current = Math.max(0, rungOrder.indexOf(w.ascension.best));
  const target = rungOrder.indexOf(targetRung);
  const foremost = measured.foremost;
  return {
    ...def,
    progress: { current, target, label: `${rungTitle(w.ascension.best)} reached; ${rungTitle(targetRung)} is the campaign horizon` },
    status: foremost ? `${foremost.name} is the foremost candidate.` : 'No living candidate is carrying the ascent.',
    next: foremost
      ? `Keep ${foremost.name} alive, read, and supplied while answering the blockers shown on the ladder.`
      : 'Name and prepare a Scion or heir rather than letting the programme choose itself.',
    relevance: [
      { surface: 'match', effect: 'advance', reason: 'A candidate’s marriage can concentrate or spend the blood the next rung needs.' },
      { surface: 'table', effect: 'advance', reason: 'Scion, heir, tutoring, and study orders are the house’s deliberate preparation for ascent.' },
      { surface: 'ladder', effect: 'advance', reason: 'The ladder’s blockers are this ambition’s derived checklist; the ambition adds no requirement of its own.' },
    ],
  };
}
