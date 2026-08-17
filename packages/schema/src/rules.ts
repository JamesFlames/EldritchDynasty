import type { Content } from './content-index.js';
import type { EventTemplate } from './event.js';
import type { Issue, ValidationRule } from './validate.js';
import { FREQUENCY_PROFILES } from './frequency.js';
import { canLearn } from './attributes.js';
import { FRAME_PROSE_SENTENCE_THRESHOLD, PROSE_SENTENCE_THRESHOLD, proseIssues } from './prose.js';

/**
 * THE RULES.
 *
 * Each one is independent, named, and testable on its own. Adding a check is
 * appending to the array at the bottom of this file; nothing else in the
 * codebase has to know it exists.
 *
 * The convention for `where` is `kind:id` or `kind:id/part`, so a warning
 * points at a file and a line in the editor without further parsing.
 */

const err = (rule: string, where: string, message: string): Issue =>
  ({ level: 'error', rule, where, message });
const warn = (rule: string, where: string, message: string): Issue =>
  ({ level: 'warning', rule, where, message });

function outcomeGroups(e: EventTemplate) {
  if (e.interaction.kind === 'narration') return [e.interaction.outcomes];
  return e.interaction.choices.map((c) => c.outcomes);
}

function allOutcomes(e: EventTemplate) {
  return outcomeGroups(e).flat();
}

function walkConditions(c: unknown, fn: (c: Record<string, unknown>) => void): void {
  if (!c || typeof c !== 'object') return;
  const o = c as Record<string, unknown>;
  fn(o);
  if (Array.isArray(o.all)) o.all.forEach((x: unknown) => walkConditions(x, fn));
  if (Array.isArray(o.any)) o.any.forEach((x: unknown) => walkConditions(x, fn));
  if (o.not) walkConditions(o.not, fn);
}

// ── Identity ──────────────────────────────────────────────────────────────

const uniqueIds: ValidationRule = {
  id: 'ids/unique',
  about: 'Two events with one id means one of them is unreachable, and save files name both.',
  check(content) {
    const issues: Issue[] = [];
    const seen = new Set<string>();
    for (const e of content.events) {
      if (seen.has(e.id)) issues.push(err(this.id, `event:${e.id}`, 'duplicate event id'));
      seen.add(e.id);
    }
    return issues;
  },
};

const threePurposes: ValidationRule = {
  id: 'event/purposes',
  about: 'CI gate 6. Exactly three distinct purposes, from the closed vocabulary (editor brief §4.5).',
  check(content) {
    return content.events
      .filter((e) => new Set(e.purposes).size !== 3)
      .map((e) => err(this.id, `event:${e.id}`, 'three DISTINCT purposes required'));
  },
};

const purposeDuplicates: ValidationRule = {
  id: 'event/purpose-overlap',
  about: 'CI gate 6. Three templates sharing all three purposes are three drafts of one event.',
  check(content) {
    const byPurpose = new Map<string, string[]>();
    for (const e of content.events) {
      const key = [...e.purposes].sort().join('+');
      byPurpose.set(key, [...(byPurpose.get(key) ?? []), e.id]);
    }
    const issues: Issue[] = [];
    for (const [key, ids] of byPurpose) {
      if (ids.length >= 3) {
        issues.push(err(this.id, 'purposes', `${ids.length} templates share all three purposes (${key}): ${ids.join(', ')}`));
      }
    }
    return issues;
  },
};

// ── Frequency obligations ─────────────────────────────────────────────────

const frequencyObligations: ValidationRule = {
  id: 'frequency/obligations',
  about: 'A tier is a set of duties, not a weight: Record blocks, folklore, caps, accounts.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      // The frame rations on its own cadence, off the ambient Frequency
      // ledger entirely (issue #13) — `frame/shape` holds it to its own,
      // stricter obligations instead.
      if (e.tier === 'frame') continue;
      const at = `event:${e.id}`;
      const p = FREQUENCY_PROFILES[e.frequency];

      if (p.record === 'required' && !e.record) {
        issues.push(err(this.id, at, `${e.frequency} events must carry a record block`));
      }
      if (p.record === 'forbidden' && e.record) {
        issues.push(err(this.id, at, 'common events must not carry a record block — the Record choice loses meaning if it is routine'));
      }
      if (p.rumour === 'always' && !e.rumour) {
        issues.push(warn(this.id, at, `${e.frequency} events should seed a rumour — the world remembers events of this weight`));
      }
      if (p.rumour === 'never' && e.rumour) {
        issues.push(warn(this.id, at, 'common events do not enter folklore'));
      }
      if (e.frequency === 'mythic' && e.repeatable) {
        issues.push(err(this.id, at, 'a mythic event that can repeat is not mythic'));
      }
      if (p.named && e.accounts.length < 2) {
        issues.push(warn(this.id, at, 'fewer than two contradicting accounts (concept §19)'));
      }
    }
    return issues;
  },
};

// ── Slots ─────────────────────────────────────────────────────────────────

const slotReferences: ValidationRule = {
  id: 'slots/references',
  about: 'Every {TOKEN} in a body names a slot the event actually declares.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      const slotIds = new Set(Object.keys(e.slots));
      for (const token of e.body.matchAll(/\{([A-Z_][A-Z0-9_]*)\}/g)) {
        const name = token[1]!;
        if (!slotIds.has(name)) {
          issues.push(err(this.id, `event:${e.id}`, `body references undefined slot {${name}}`));
        }
      }
    }
    return issues;
  },
};

const arcBoundSlots: ValidationRule = {
  id: 'slots/arc-bound',
  about: 'A slot bound for a whole substory needs an arc, and an absent-body if it may go missing.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      for (const [sid, spec] of Object.entries(e.slots)) {
        const at = `event:${e.id}/${sid}`;
        if (spec.bind === 'arc' && !e.arc) {
          issues.push(warn(this.id, at, 'arc-bound slot on an event that belongs to no arc'));
        }
        if (spec.bind === 'arc' && spec.onMissing === 'continue_absent' && !e.absentBody) {
          issues.push(err(this.id, at, 'continue_absent requires absentBody — otherwise this renders a token for a man forty years in the ground'));
        }
      }
    }
    return issues;
  },
};

// ── The Madness gate (invariant 1) ────────────────────────────────────────

const madnessGate: ValidationRule = {
  id: 'madness/gate',
  about: 'Madness may only be dealt to a target the slot has already gated to someone who can express.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      for (const o of allOutcomes(e)) {
        for (const eff of o.effects) {
          if (eff.kind !== 'madness' || eff.delta <= 0) continue;
          const t = eff.target;
          const slot = typeof t === 'object' && 'slot' in t ? e.slots[t.slot] : undefined;
          const guarded = slot?.filters.some((f) => 'canExpress' in f && f.canExpress === true)
            || slot?.filters.some((f) => 'sex' in f && f.sex === 'male');
          if (!guarded) {
            issues.push(err(
              this.id,
              `event:${e.id}/${o.id}`,
              'madness effect on a target not gated to canExpress — women and mundane men cannot go mad (concept §10)',
            ));
          }
        }
      }
    }
    return issues;
  },
};

// ── Cross-references ──────────────────────────────────────────────────────

const knownReferences: ValidationRule = {
  id: 'refs/known',
  about: 'Ages, arcs, knowledge flags, tales and their about-events named by content must be things that exist.',
  check(content) {
    const issues: Issue[] = [];

    const granted = new Set<string>();
    for (const e of content.events) {
      for (const o of allOutcomes(e)) {
        for (const eff of o.effects) {
          if (eff.kind === 'knowledge' && eff.op === 'grant') granted.add(eff.flag);
        }
      }
      if (e.record?.options.record.grantsKnowledge) granted.add(e.record.options.record.grantsKnowledge);
    }

    for (const e of content.events) {
      const at = `event:${e.id}`;
      for (const a of [...(e.ages?.only ?? []), ...(e.ages?.never ?? [])]) {
        if (!content.age(a)) issues.push(err(this.id, at, `unknown age '${a}'`));
      }
      for (const id of e.accounts) {
        if (!content.tale(id)) issues.push(err(this.id, at, `unknown tale '${id}' in accounts`));
      }
      for (const o of allOutcomes(e)) {
        for (const eff of o.effects) {
          if (eff.kind === 'arc' && !content.arc(eff.arc)) {
            issues.push(err(this.id, `${at}/${o.id}`, `unknown arc '${eff.arc}'`));
          }
          if (eff.kind === 'schedule' && !content.event(eff.event)) {
            issues.push(err(this.id, `${at}/${o.id}`, `schedules unknown event '${eff.event}'`));
          }
          if (eff.kind === 'heirloom' && !content.heirloom(eff.heirloom)) {
            issues.push(err(this.id, `${at}/${o.id}`, `unknown heirloom '${eff.heirloom}'`));
          }
          if (eff.kind === 'clause' && !content.clause(eff.reveal)) {
            issues.push(err(this.id, `${at}/${o.id}`, `reveals unknown clause '${eff.reveal}'`));
          }
        }
      }
      walkConditions(e.conditions, (c) => {
        if ('knowledge' in c && c.has === true && !granted.has(String(c.knowledge))) {
          issues.push(err(this.id, at, `knowledge condition '${String(c.knowledge)}' is granted by no event`));
        }
      });
    }

    for (const t of content.tales) {
      if (!content.event(t.about)) {
        issues.push(err(this.id, `tale:${t.id}`, `'about' names unknown event '${t.about}'`));
      }
    }
    return issues;
  },
};

const accountsContradict: ValidationRule = {
  id: 'tales/accounts',
  about: 'CI gate 8. Every pair of an event\'s accounts must contradict on at least one field '
    + '— differing bias is the minimum bar (issue #14). Two accounts that agree are one account written twice.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      if (e.accounts.length < 2) continue;
      const at = `event:${e.id}`;
      // Unknown ids are `refs/known`'s complaint, not this rule's.
      const tales = e.accounts.map((id) => content.tale(id)).filter((t): t is NonNullable<typeof t> => t !== undefined);
      for (let i = 0; i < tales.length; i++) {
        for (let j = i + 1; j < tales.length; j++) {
          if (tales[i]!.bias === tales[j]!.bias) {
            issues.push(err(
              this.id,
              at,
              `accounts '${tales[i]!.id}' and '${tales[j]!.id}' do not contradict — both are '${tales[i]!.bias}'`,
            ));
          }
        }
      }
    }
    return issues;
  },
};

const discrepancyWiring: ValidationRule = {
  id: 'discrepancy/wiring',
  about: 'A Discrepancy proved or buried without ever being created cannot be found; provableBy must name a real house.',
  check(content) {
    const issues: Issue[] = [];
    const created = new Set<string>();
    const provedOrBuried: { id: string; op: 'prove' | 'bury'; at: string }[] = [];

    const checkProvableBy = (ids: string[], at: string) => {
      for (const houseId of ids) {
        if (!content.house(houseId)) issues.push(err(this.id, at, `provableBy names unknown house '${houseId}'`));
      }
    };

    for (const e of content.events) {
      const at = `event:${e.id}`;
      for (const o of allOutcomes(e)) {
        for (const eff of o.effects) {
          if (eff.kind !== 'discrepancy') continue;
          const where = `${at}/${o.id}`;
          if (eff.op === 'create') {
            created.add(eff.id);
            checkProvableBy(eff.provableBy ?? [], where);
          } else {
            provedOrBuried.push({ id: eff.id, op: eff.op, at: where });
          }
        }
      }
      if (e.record) {
        const d = e.record.options.embellish.discrepancy;
        created.add(d.id);
        checkProvableBy(d.provableBy, `${at}/record/embellish`);
      }
    }

    for (const p of provedOrBuried) {
      if (!created.has(p.id)) {
        const verb = p.op === 'prove' ? 'proves' : 'buries';
        issues.push(err(this.id, p.at, `${verb} Discrepancy '${p.id}', which nothing ever creates`));
      }
    }
    return issues;
  },
};

const arcWiring: ValidationRule = {
  id: 'arcs/wiring',
  about: 'An arc that points at a node or an event that is not there dies silently at that node.',
  check(content) {
    const issues: Issue[] = [];
    for (const arc of content.arcs) {
      const nodeIds = new Set(arc.nodes.map((n) => n.id));
      if (!nodeIds.has(arc.entry)) {
        issues.push(err(this.id, `arc:${arc.id}`, `entry node '${arc.entry}' not found`));
      }
      for (const n of arc.nodes) {
        if (!content.event(n.event)) {
          issues.push(err(this.id, `arc:${arc.id}/${n.id}`, `unknown event '${n.event}'`));
        }
        for (const s of n.successors) {
          if (s.to !== 'end' && !nodeIds.has(s.to)) {
            issues.push(err(this.id, `arc:${arc.id}/${n.id}`, `successor '${s.to}' not found`));
          }
        }
      }
    }
    return issues;
  },
};

// ── Shape of the writing ──────────────────────────────────────────────────

const outcomeWeights: ValidationRule = {
  id: 'outcomes/weights',
  about: 'A group of outcomes whose weights sum to zero can never resolve.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      // A checked choice resolves by band (issue #10), so its outcomes' own
      // weights are unused — asking them to sum to 100 would be enforcing a
      // number nothing reads.
      const groups = e.interaction.kind !== 'narration'
        ? e.interaction.choices.filter((c) => c.check === undefined).map((c) => c.outcomes)
        : outcomeGroups(e);
      for (const group of groups) {
        const sum = group.reduce((s, o) => s + o.weight, 0);
        if (sum === 0) issues.push(err(this.id, `event:${e.id}`, 'outcome weights sum to zero'));
        else if (sum !== 100) issues.push(warn(this.id, `event:${e.id}`, `outcome weights sum to ${sum}, not 100`));
      }
    }
    return issues;
  },
};

const choiceShape: ValidationRule = {
  id: 'event/shape',
  about: 'A choice with one option is narration; a body of twenty words is a stub.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      if (e.interaction.kind === 'choice' && e.interaction.choices.length < 2) {
        issues.push(err(this.id, `event:${e.id}`, 'a choice event needs at least two options'));
      }
      if (e.body.split(/\s+/).length < 25) {
        issues.push(warn(this.id, `event:${e.id}`, 'body under 25 words'));
      }
    }
    return issues;
  },
};

const checksWiring: ValidationRule = {
  id: 'checks/wiring',
  about: 'A Check must be declared to be named, its bands ordered highest-first, and every band must name a real outcome.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      const at = `event:${e.id}`;

      for (const c of e.checks) {
        const thresholds = c.bands.map((b) => b.atLeast);
        for (let i = 1; i < thresholds.length; i++) {
          if (thresholds[i]! >= thresholds[i - 1]!) {
            issues.push(err(this.id, `${at}/check:${c.id}`, 'bands must be strictly descending by atLeast, highest threshold first'));
            break;
          }
        }
      }

      if (e.interaction.kind === 'narration') continue;
      for (const choice of e.interaction.choices) {
        if (choice.check === undefined) continue;
        const at2 = `${at}/${choice.id}`;
        const check = e.checks.find((c) => c.id === choice.check);
        if (!check) {
          issues.push(err(this.id, at2, `names check '${choice.check}', which this event does not declare`));
          continue;
        }
        const outcomeIds = new Set(choice.outcomes.map((o) => o.id));
        for (const b of check.bands) {
          if (!outcomeIds.has(b.outcome)) {
            issues.push(err(this.id, at2, `check '${check.id}' band names outcome '${b.outcome}', which this choice does not have`));
          }
        }
      }
    }
    return issues;
  },
};

const voiceContract: ValidationRule = {
  id: 'prose/voice',
  about: 'Bodies over five sentences are held to the countable half of the prose manual. '
    + 'The frame answers to a tighter budget (issue #13).',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      const threshold = e.tier === 'frame' ? FRAME_PROSE_SENTENCE_THRESHOLD : PROSE_SENTENCE_THRESHOLD;
      issues.push(...proseIssues(`event:${e.id}`, e.body, threshold));
      if (e.absentBody) issues.push(...proseIssues(`event:${e.id}/absentBody`, e.absentBody, threshold));
    }
    return issues;
  },
};

// ── The frame (concept §2, Layer 1; issue #13) ────────────────────────────

const frameShape: ValidationRule = {
  id: 'frame/shape',
  about: 'The frame reacts to the record: no effects, no Record block, no rumour, no choices, '
    + 'no slot against the living family, and at least one read to react to. `reads` is frame-only.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      const at = `event:${e.id}`;

      if (e.tier !== 'frame') {
        if (e.reads.length) {
          issues.push(err(this.id, at, `'reads' is frame-only; this event is tier '${e.tier}'`));
        }
        continue;
      }

      if (e.reads.length === 0) {
        issues.push(err(this.id, at, 'a frame event declares no reads — it has nothing to react to'));
      }
      if (e.conditions) {
        issues.push(err(this.id, at, 'the frame gates on reads, not conditions — conditions read live household state, which the frame never looks at'));
      }
      if (e.record) {
        issues.push(err(this.id, at, 'the frame never dispenses systems information — no Record block'));
      }
      if (e.rumour) {
        issues.push(err(this.id, at, 'the frame is not part of the tale — it does not enter folklore'));
      }
      if (e.interaction.kind !== 'narration') {
        issues.push(err(this.id, at, 'the frame never asks the player anything — narration only'));
      }
      for (const [sid, spec] of Object.entries(e.slots)) {
        if (spec.role !== 'listener_record' && spec.role !== 'listener_blood') {
          issues.push(err(this.id, `${at}/${sid}`, `the frame casts only the two listener roles, not '${spec.role}'`));
        }
      }
      for (const o of allOutcomes(e)) {
        if (o.effects.length) {
          issues.push(err(this.id, `${at}/${o.id}`, 'the frame reacts — it does not change anything'));
        }
      }
    }
    return issues;
  },
};

// ── The world around the events ───────────────────────────────────────────

const ageCoverage: ValidationRule = {
  id: 'ages/coverage',
  about: 'An Age with no content of its own is a modifier wearing a name.',
  check(content) {
    const issues: Issue[] = [];
    for (const age of content.ages) {
      const owned = content.events.filter((e) => e.ages?.only?.includes(age.id)).length;
      if (owned < 4) {
        issues.push(warn(this.id, `age:${age.id}`, `only ${owned} exclusive events — an Age with no content of its own is a modifier wearing a name`));
      }
      if (age.clauseBearing && age.duration.medianYears < 25) {
        issues.push(warn(this.id, `age:${age.id}`, 'clause-bearing Age with a short median span; consider clauseBearing: false'));
      }
    }
    return issues;
  },
};

const clauseAssignment: ValidationRule = {
  id: 'clause/ages',
  about: 'CI gate 7. A clause pinned to fewer than two Ages is a clause some runs never see.',
  check(content) {
    const issues: Issue[] = [];
    for (const c of content.clauses) {
      const at = `clause:${c.id}`;
      for (const a of c.ages) {
        if (!content.age(a)) issues.push(err(this.id, at, `unknown age '${a}'`));
      }
      if (c.ages.length < 2) {
        issues.push(err(this.id, at, `assigned to ${c.ages.length} Age(s) — every clause needs at least two`));
      }
    }
    return issues;
  },
};

const mysticRestriction: ValidationRule = {
  id: 'traits/mystic-restriction',
  about: 'Women practise only the Threshold four (concept §9), so a female-tagged elemental trait is unlearnable.',
  check(content) {
    const issues: Issue[] = [];
    for (const t of content.traits) {
      if (t.acquisition.kind !== 'threshold') continue;
      const attr = String(t.acquisition.attr);
      if (!canLearn('female', attr) && t.tags.includes('female' as never)) {
        issues.push(warn(this.id, `trait:${t.id}`, 'female-tagged trait keyed to an elemental affinity'));
      }
    }
    return issues;
  },
};

/**
 * Registered in the order the panel should show them: identity, then
 * obligations, then wiring, then writing. Order has no other meaning — every
 * rule is independent, and `runRule` takes any one of them alone.
 */
export const CONTENT_RULES: readonly ValidationRule[] = [
  uniqueIds,
  threePurposes,
  frequencyObligations,
  slotReferences,
  arcBoundSlots,
  madnessGate,
  knownReferences,
  accountsContradict,
  discrepancyWiring,
  arcWiring,
  outcomeWeights,
  choiceShape,
  checksWiring,
  ageCoverage,
  clauseAssignment,
  mysticRestriction,
  purposeDuplicates,
  voiceContract,
  frameShape,
];
