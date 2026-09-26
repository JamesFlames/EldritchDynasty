import type { Person } from '@ed/schema';
import type { GenerationQuestion, SimCtx } from './world.js';
import { heirApparent } from './people/succession.js';
import { branchOf } from './people/branches.js';
import { rungTitle } from './ascension.js';
import { campaignDef } from './campaign.js';

type Candidate = GenerationQuestion & { score: number };

const openDiscrepancies = (ctx: SimCtx): number =>
  [...ctx.world.discrepancies.values()].filter((d) => d.state === 'open').length;

const livingBlood = (ctx: SimCtx): Person[] =>
  ctx.world.people.blood(ctx.world.playerHouse).filter((p) => p.status === 'alive');

function candidate(
  kind: GenerationQuestion['kind'],
  score: number,
  text: string,
  opened: number,
  baseline: number,
  subject?: Person,
): Candidate {
  const signature = `${kind}:${subject?.id ?? '-'}`;
  return {
    kind, score, text, opened, baseline, signature,
    ...(subject ? { subject: subject.id, subjectName: subject.name } : {}),
  };
}

/**
 * ONE QUESTION FOR ONE GENERATION (issue #213).
 *
 * Pure. It reads pressures that already exist and chooses the strongest one.
 * The chosen value is copied onto the succession record by the two places a
 * Head can first take the seal, so it cannot change underneath the player as
 * the generation unfolds.
 */
export function chooseGenerationQuestion(
  ctx: SimCtx,
  previous?: GenerationQuestion,
): GenerationQuestion | undefined {
  const w = ctx.world;
  const head = w.people.living().find((p) => p.castSlots.includes('head'));
  if (!head) return undefined;

  const candidates: Candidate[] = [];
  const heir = heirApparent(ctx, head.id);
  if (heir && heir.madness >= 25) {
    candidates.push(candidate(
      'unstable_heir', 100,
      `${heir.name} stands nearest the seal, and the strain is already visible. Do we risk the line on him?`,
      w.year, heir.madness, heir,
    ));
  }

  const blood = livingBlood(ctx);
  const thinAt = Math.max(5, Math.floor(w.bloodHighWater * 0.35));
  if (blood.length <= thinAt) {
    candidates.push(candidate(
      'thin_line', 90,
      `Only ${blood.length} of the blood are living. Can ${head.name} leave the line stronger than he found it?`,
      w.year, blood.length, head,
    ));
  }

  const discrepancies = openDiscrepancies(ctx);
  if (discrepancies >= 2) {
    candidates.push(candidate(
      'record', 80,
      `The chronicle carries ${discrepancies} open contradictions. Does ${head.name} protect the legend, or leave something the house can prove?`,
      w.year, discrepancies, head,
    ));
  }

  const totalClauses = campaignDef(w.campaign).clauses;
  const remaining = totalClauses - w.clausesRecovered.size;
  if (remaining > 0 && remaining <= 2) {
    candidates.push(candidate(
      'ledger', 70,
      `The Ledger is ${remaining === 1 ? 'one clause' : `${remaining} clauses`} from complete. Does ${head.name} fund the reading, or the house that must survive it?`,
      w.year, w.clausesRecovered.size, head,
    ));
  }

  const troubled = [...w.branches.values()]
    .filter((b) => b.grievance >= 60)
    .sort((a, b) => b.grievance - a.grievance)[0];
  if (troubled) {
    candidates.push({
      kind: 'branch',
      score: 60,
      text: `${troubled.name} is close to breaking with the seat. Can ${head.name} keep that hall in the family?`,
      opened: w.year,
      baseline: troubled.grievance,
      subject: troubled.id,
      subjectName: troubled.name,
      signature: `branch:${troubled.id}`,
    });
  }

  const daughter = blood
    .filter((p) => p.sex === 'female' && w.year - p.born >= 16 && w.year - p.born <= 38
      && !p.marriages.some((m) => m.to === undefined))
    .sort((a, b) => a.born - b.born)[0];
  if (daughter) {
    candidates.push(candidate(
      'match', 50,
      `${daughter.name} is old enough for the Match. Is her blood kept close, or spent outward for what the house needs now?`,
      w.year, 0, daughter,
    ));
  }

  if (w.ascension.rung !== 'none') {
    candidates.push(candidate(
      'ascension', 40,
      `${head.name} inherits a house standing at ${rungTitle(w.ascension.rung)}. Can this generation hold the climb without spending the line beneath it?`,
      w.year, Object.keys(w.ascension.reachedAt).length, head,
    ));
  }

  candidates.sort((a, b) => b.score - a.score || a.signature.localeCompare(b.signature));
  const picked = candidates.find((c) => c.signature !== previous?.signature);
  if (!picked) return undefined;
  const { score: _score, ...question } = picked;
  return question;
}

/** What actually became of a generation's opening question. No projected outcomes. */
export function answerGenerationQuestion(ctx: SimCtx, q: GenerationQuestion): string {
  const w = ctx.world;
  const subject = q.subject ? w.people.get(q.subject) : undefined;

  switch (q.kind) {
    case 'unstable_heir': {
      if (!subject || subject.status !== 'alive') {
        return `${q.subjectName ?? 'The heir'} did not live to take the seal.`;
      }
      if (subject.castSlots.includes('head')) {
        return `${subject.name} took the seal. His Madness now stands at ${Math.round(subject.madness)}, against ${Math.round(q.baseline)} when the question opened.`;
      }
      return `${subject.name} lived through the generation but did not take the seal; his Madness now stands at ${Math.round(subject.madness)}.`;
    }
    case 'thin_line': {
      const now = livingBlood(ctx).length;
      const direction = now > q.baseline ? 'grew' : now < q.baseline ? 'thinned' : 'held';
      return `The living blood ${direction}: ${q.baseline} when the generation opened, ${now} when it closed.`;
    }
    case 'record': {
      const now = openDiscrepancies(ctx);
      const proved = [...w.discrepancies.values()].filter((d) => d.state === 'proven').length;
      return `The book closed the generation with ${now} open contradictions; ${proved} had been proven by then.`;
    }
    case 'ledger': {
      const now = w.clausesRecovered.size;
      return `The house recovered ${Math.max(0, now - q.baseline)} Ledger clause${now - q.baseline === 1 ? '' : 's'} during the generation, bringing the total to ${now}.`;
    }
    case 'branch': {
      const branch = q.subject ? w.branches.get(q.subject) : undefined;
      if (!branch) return `${q.subjectName ?? 'The troubled hall'} did not remain a standing cadet hall.`;
      return `${branch.name}'s grievance stands at ${Math.round(branch.grievance)}, against ${Math.round(q.baseline)} when the generation opened.`;
    }
    case 'match': {
      if (!subject || subject.status !== 'alive') return `${q.subjectName ?? 'The daughter'} did not live to make that marriage.`;
      const marriage = subject.marriages.find((m) => m.to === undefined);
      if (!marriage) return `${subject.name} remained unmarried when the generation closed.`;
      const spouse = w.people.get(marriage.spouse);
      const outward = spouse && spouse.houseOfOrigin !== w.playerHouse;
      return outward
        ? `${subject.name} married outward, into ${ctx.content.house(spouse!.houseOfOrigin)?.name ?? spouse!.houseOfOrigin}.`
        : `${subject.name} married within the house's own blood.`;
    }
    case 'ascension':
      return `The house closes the generation at ${rungTitle(w.ascension.rung)}; its high-water mark is ${rungTitle(w.ascension.best)}.`;
  }
}
