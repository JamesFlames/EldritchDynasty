import type { Content } from './content-index.js';
import type { EventTemplate } from './event.js';
import type { Issue, ValidationRule } from './validate.js';
import { FREQUENCY_PROFILES } from './frequency.js';
import { canLearn } from './attributes.js';
import { FRAME_PROSE_SENTENCE_THRESHOLD, PROSE_SENTENCE_THRESHOLD, proseIssues } from './prose.js';
import { isInlineArcId } from './desugar.js';

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

function choicesOf(e: EventTemplate) {
  return e.interaction.kind === 'narration' ? [] : e.interaction.choices;
}

/** The decider, spelled the same way for all three interaction kinds. */
function deciderOf(e: EventTemplate) {
  return e.interaction.kind === 'narration' ? ('chance' as const) : e.interaction.decidedBy;
}

/**
 * The check a `party` decider spends, if any. A check named here resolves a
 * BRANCH; a check named by `Choice.check` resolves an outcome inside one. Which
 * of the two a check is decides what its bands are allowed to name, so this
 * question gets asked in three rules and is worth one function.
 */
function branchCheckOf(e: EventTemplate): string | undefined {
  const d = deciderOf(e);
  return typeof d === 'object' && 'party' in d ? d.party.check : undefined;
}

/** Filters nest through `all`/`any`/`not` exactly as conditions do. */
function walkFilters(fs: unknown[], fn: (f: Record<string, unknown>) => void): void {
  for (const raw of fs) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as Record<string, unknown>;
    fn(f);
    if (Array.isArray(f.all)) walkFilters(f.all, fn);
    if (Array.isArray(f.any)) walkFilters(f.any, fn);
    if (f.not) walkFilters([f.not], fn);
  }
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
  about: 'Every {TOKEN} names a declared slot, and a relation filter names one that is cast before it.',
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

      /**
       * `evalFilter` PASSES a `relation` filter whose counterpart slot is not
       * cast yet, because a comparison with nobody is not one it can judge. So
       * a filter that can never see its counterpart is inert — a declared
       * constraint that does nothing, which is invariant 11's exact shape.
       *
       * `resolveSlots` fills slots in DEPENDENCY order now, so this is no
       * longer a matter of what the author happened to name things. Two cases
       * remain, and both are real:
       *
       *   a filter naming a slot the event does not declare, and
       *   a CYCLE, which no order can satisfy — `A` not `B` while `B` is not
       *   `A` means whichever fills first has an inert filter.
       */
      const deps = new Map<string, string[]>();
      for (const [sid, spec] of Object.entries(e.slots)) {
        const targets: string[] = [];
        walkFilters(spec.filters, (f) => {
          if (!('relation' in f)) return;
          const other = String((f as { of: string }).of);
          if (!slotIds.has(other)) {
            issues.push(err(this.id, `event:${e.id}/${sid}`, `relation filter names undefined slot '${other}'`));
            return;
          }
          if (other !== sid) targets.push(other);
        });
        deps.set(sid, targets);
      }

      // Anything left unplaced by a topological pass is in a cycle.
      const placed = new Set<string>();
      for (let pass = 0; pass < deps.size && placed.size < deps.size; pass++) {
        const ready = [...deps].filter(([n, ds]) => !placed.has(n) && ds.every((d) => placed.has(d)));
        if (!ready.length) break;
        for (const [n] of ready) placed.add(n);
      }
      for (const sid of deps.keys()) {
        if (placed.has(sid)) continue;
        issues.push(err(this.id, `event:${e.id}/${sid}`,
          'this slot\'s relation filters form a cycle — whichever fills first compares against nobody, '
          + 'so one of them narrows nothing'));
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
  about: 'Ages, arcs, careers, spellbooks, knowledge flags, tales and their about-events named by content must be things that exist.',
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
          // A career or a book named by a typo is not a loud failure anywhere
          // downstream. `applyEffect` now declines the placement outright and
          // `gainSpellbook` resolves the volume to nothing, so the outcome
          // fires, reads as though it worked, and does nothing for the rest of
          // the run. This is the only place that can still say so.
          if (eff.kind === 'career' && eff.op === 'assign' && eff.career && !content.career(eff.career)) {
            issues.push(err(this.id, `${at}/${o.id}`, `assigns unknown career '${eff.career}'`));
          }
          if (eff.kind === 'spellbook' && !content.spellbook(eff.book)) {
            issues.push(err(this.id, `${at}/${o.id}`, `unknown spellbook '${eff.book}'`));
          }
        }
      }
      // A `career` filter naming a post that does not exist matches nobody, so
      // the slot never fills and the event never fires — silence of exactly the
      // kind this rule exists to break.
      for (const [slot, spec] of Object.entries(e.slots)) {
        walkFilters(spec.filters, (f) => {
          if (!Array.isArray(f.career)) return;
          for (const id of f.career) {
            if (!content.career(String(id))) {
              issues.push(err(this.id, `${at}/${slot}`, `filters on unknown career '${String(id)}'`));
            }
          }
        });
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
        const event = content.event(n.event);
        if (!event) {
          issues.push(err(this.id, `arc:${arc.id}/${n.id}`, `unknown event '${n.event}'`));
        }
        for (const s of n.successors) {
          if (s.to !== 'end' && !nodeIds.has(s.to)) {
            issues.push(err(this.id, `arc:${arc.id}/${n.id}`, `successor '${s.to}' not found`));
          }
          // A guard naming an outcome, a branch or a tag the parent cannot
          // produce is a guard that never holds — a successor that is written
          // down, looks wired, and is unreachable for the life of the game.
          if (!event) continue;
          const at = `arc:${arc.id}/${n.id}`;
          if (s.fromOutcome && !allOutcomes(event).some((o) => o.id === s.fromOutcome)) {
            issues.push(err(this.id, at, `fromOutcome '${s.fromOutcome}' is not an outcome of '${event.id}'`));
          }
          if (s.fromChoice && !choicesOf(event).some((c) => c.id === s.fromChoice)) {
            issues.push(err(this.id, at, `fromChoice '${s.fromChoice}' is not a branch of '${event.id}'`));
          }
          if (s.fromTag && !allOutcomes(event).some((o) => o.tags.includes(s.fromTag!))) {
            issues.push(err(this.id, at, `fromTag '${s.fromTag}' is on no outcome of '${event.id}'`));
          }
        }
      }
    }

    // THE REVERSE CHECK, which is the one that was missing. An arc pointing at
    // a node that is not there has always failed the build; an EVENT claiming
    // to be a node of an arc that does not know it never did. The symptom is
    // the worst kind: the event leaves the ambient pool (anything with an `arc`
    // block does) and the arc never calls it, so it is authored, validated, and
    // unreachable in every run.
    for (const e of content.events) {
      if (!e.arc) continue;
      const at = `event:${e.id}`;
      const arc = content.arc(e.arc.of);
      if (!arc) {
        issues.push(err(this.id, at, `is a node of unknown arc '${e.arc.of}'`));
        continue;
      }
      const node = arc.nodes.find((n) => n.id === e.arc!.node);
      if (!node) {
        issues.push(err(this.id, at, `arc '${arc.id}' has no node '${e.arc.node}'`));
      } else if (node.event !== e.id) {
        issues.push(err(this.id, at, `arc '${arc.id}' node '${node.id}' runs '${node.event}', not this event`));
      }
    }

    // Inline follow-ups (`Outcome.next`) before `desugar.ts` compiles them.
    for (const e of content.events) {
      for (const o of allOutcomes(e)) {
        const link = o.next;
        if (!link) continue;
        const at = `event:${e.id}/${o.id}`;
        const target = content.event(link.event);
        if (!target) {
          issues.push(err(this.id, at, `next names unknown event '${link.event}'`));
          continue;
        }
        for (const slot of link.keep) {
          if (!target.slots[slot]) {
            issues.push(err(this.id, at, `keeps slot '${slot}', which '${target.id}' does not declare`));
          }
          if (!e.slots[slot]) {
            issues.push(err(this.id, at, `keeps slot '${slot}', which this event does not cast`));
          }
        }
        if (link.event === e.id) {
          issues.push(err(this.id, at, 'next points at its own event'));
        }
      }
    }
    return issues;
  },
};

/**
 * `Outcome.next` compiles into `triggers`, and an outcome that already has one
 * keeps it (see `desugar.ts`) — so the inline follow-up would be silently
 * dropped. Saying so is better than picking a winner nobody asked for.
 */
const inlineCollision: ValidationRule = {
  id: 'arcs/inline',
  about: 'An inline follow-up must belong to exactly one chain, and must not compete with an authored arc.',
  check(content) {
    const issues: Issue[] = [];

    // An outcome's `next` compiles into `triggers`, and `desugar.ts` leaves an
    // authored `triggers` alone — so the follow-up would be silently dropped.
    // Saying so beats picking a winner nobody asked for.
    for (const e of content.events) {
      for (const o of allOutcomes(e)) {
        // `desugar.ts` runs before validation does, so by now every `next` has
        // grown the `triggers` that starts its compiled arc. Only an AUTHORED
        // one is a collision — the compiled id is this pass's own work.
        if (o.next && o.triggers && !isInlineArcId(o.triggers.arc)) {
          issues.push(err(this.id, `event:${e.id}/${o.id}`,
            `declares next '${o.next.event}' and triggers arc '${o.triggers.arc}' — the follow-up would be discarded`));
        }
      }
    }

    // One event can carry one `arc` block, so a follow-up can belong to one
    // chain. Two chains leading to the same scene means one of them ends there
    // and the other silently does not.
    const reachedFrom = new Map<string, string[]>();
    for (const e of content.events) {
      for (const o of allOutcomes(e)) {
        if (!o.next) continue;
        const from = reachedFrom.get(o.next.event) ?? [];
        from.push(`${e.id}/${o.id}`);
        reachedFrom.set(o.next.event, from);
      }
    }
    for (const [target, from] of reachedFrom) {
      if (from.length > 1) {
        issues.push(err(this.id, `event:${target}`,
          `is the inline follow-up of ${from.length} outcomes (${from.join(', ')}) — an event can only be a node of one chain`));
      }
    }

    // A chain nothing leads into can never start. `desugarInline` compiles
    // nothing for it, correctly, and the events sit there looking authored.
    const followUps = new Set(reachedFrom.keys());
    const linked = content.events.filter((e) => allOutcomes(e).some((o) => o.next));
    if (linked.length && linked.every((e) => followUps.has(e.id))) {
      issues.push(err(this.id, 'events', 'every inline follow-up is itself a follow-up — the chain is a cycle with no beat that can start it'));
    }
    return issues;
  },
};

/**
 * Story-local memory is only local to a story. Written by an event that is not
 * a node of one, nothing can ever read it; read where no arc is in scope, it is
 * false forever. Both are silent, and both look exactly like a guard that is
 * simply never satisfied.
 */
const arcFlags: ValidationRule = {
  id: 'arcs/flags',
  about: 'arc_flag effects and arcFlag/arcVisited conditions only mean anything inside a substory.',
  check(content) {
    const issues: Issue[] = [];
    const nodeIdsOf = (arcId: string) => new Set((content.arc(arcId)?.nodes ?? []).map((n) => n.id));

    for (const e of content.events) {
      const at = `event:${e.id}`;
      const inArc = Boolean(e.arc);

      for (const o of allOutcomes(e)) {
        for (const eff of o.effects) {
          if (eff.kind !== 'arc_flag') continue;
          if (!inArc) {
            issues.push(err(this.id, `${at}/${o.id}`,
              `sets arc flag '${eff.flag}', but this event is not a node of any substory — nothing can read it`));
          }
        }
      }

      // An event's own `conditions` are evaluated by the ambient selection pass,
      // where no arc is in scope even for an arc node. That is a warning rather
      // than an error only because an arc node's conditions are not consulted at
      // all — the arc calls it directly — so it is dead weight, not a lie.
      walkConditions(e.conditions, (c) => {
        if ('arcFlag' in c || 'arcVisited' in c) {
          issues.push(warn(this.id, at,
            'an arcFlag/arcVisited condition on an event is always false — put it on the successor\'s `when` instead'));
        }
      });
    }

    for (const arc of content.arcs) {
      const nodes = nodeIdsOf(arc.id);
      for (const n of arc.nodes) {
        for (const s of n.successors) {
          walkConditions(s.when, (c) => {
            if ('arcVisited' in c && !nodes.has(String(c.arcVisited))) {
              issues.push(err(this.id, `arc:${arc.id}/${n.id}`,
                `arcVisited names '${String(c.arcVisited)}', which is not a node of this arc`));
            }
          });
        }
      }
    }
    return issues;
  },
};

/**
 * A decider that names something that is not there does not fail — it falls
 * through to a weighted draw, which is a working event that quietly ignores the
 * rule its author wrote.
 */
const deciderWiring: ValidationRule = {
  id: 'decider/wiring',
  about: 'A state ladder must name real branches and end in an unguarded rung; a party decider needs a check and a party.',
  check(content) {
    const issues: Issue[] = [];
    for (const e of content.events) {
      const d = deciderOf(e);
      if (typeof d !== 'object') continue;
      const at = `event:${e.id}`;
      const choices = choicesOf(e);

      if ('state' in d) {
        for (const rung of d.state) {
          if (!choices.some((c) => c.id === rung.take)) {
            issues.push(err(this.id, at, `state rung takes '${rung.take}', which is not a branch of this event`));
          }
        }
        if (d.state.every((r) => r.when !== undefined)) {
          issues.push(warn(this.id, at,
            'every rung of this ladder is guarded — when none of them holds the branch is drawn by weight, '
            + 'which is rarely what a ladder is for. A final rung with no `when` is the else.'));
        }
        continue;
      }

      const check = e.checks.find((c) => c.id === d.party.check);
      if (!check) {
        issues.push(err(this.id, at, `party decider names check '${d.party.check}', which this event does not declare`));
      }
      // The point of delegating is that the player picks who. An event with no
      // player-cast slot delegates to whoever the engine happened to cast,
      // which is a check wearing a decision's clothes.
      if (!Object.values(e.slots).some((sl) => sl.castBy === 'player')) {
        issues.push(err(this.id, at,
          'a party decider needs at least one `castBy: player` slot — the party the player names is the decision'));
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

/**
 * A check's bands name one of two different things depending on what the check
 * is FOR, and the difference is not visible in the check itself.
 *
 *   Choice.check          resolves an outcome INSIDE a branch already taken.
 *                         Bands name outcome ids.
 *   decidedBy.party.check resolves WHICH BRANCH is taken (`decider.ts`).
 *                         Bands name choice ids.
 *
 * A check used as both would need its bands to mean both at once, which is why
 * that is an error rather than a clever feature.
 */
const checksWiring: ValidationRule = {
  id: 'checks/wiring',
  about: 'A Check must be declared to be named, its bands ordered highest-first, and every band must name a real '
    + 'outcome — or, for a check a party decider spends, a real branch.',
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

      const branchCheck = branchCheckOf(e);
      if (branchCheck !== undefined) {
        const check = e.checks.find((c) => c.id === branchCheck);
        const branchIds = new Set(e.interaction.choices.map((c) => c.id));
        if (check) {
          for (const b of check.bands) {
            if (!branchIds.has(b.outcome)) {
              issues.push(err(this.id, `${at}/check:${check.id}`,
                `this check decides the BRANCH, so its bands name choices — '${b.outcome}' is not one of them`));
            }
          }
        }
        if (e.interaction.choices.some((c) => c.check === branchCheck)) {
          issues.push(err(this.id, `${at}/check:${branchCheck}`,
            'is spent both to pick the branch and to resolve one — its bands cannot name choices and outcomes at once'));
        }
      }

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

// ── Gene pools ────────────────────────────────────────────────────────────

const genePoolAlleles: ValidationRule = {
  id: 'houses/alleles',
  about: 'A house\'s gene pool must name loci and alleles that exist, or it is a '
    + 'characterisation the genome never receives.',
  check(content) {
    const issues: Issue[] = [];
    const allelesByLocus = new Map(content.loci.map((l) => [String(l.id), new Set(l.alleles.map((a) => String(a.id)))]));

    for (const h of content.houses) {
      for (const [locus, overrides] of Object.entries(h.genePool.frequencies)) {
        const known = allelesByLocus.get(locus);
        if (!known) {
          issues.push(err(this.id, `house:${h.id}`, `gene pool overrides unknown locus '${locus}'`));
          continue;
        }
        for (const o of overrides) {
          if (!known.has(String(o.allele))) {
            issues.push(err(
              this.id,
              `house:${h.id}/${locus}`,
              `unknown allele '${String(o.allele)}' — the override is dropped and the house rolls the world baseline`,
            ));
          }
        }
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
  inlineCollision,
  arcFlags,
  deciderWiring,
  outcomeWeights,
  choiceShape,
  checksWiring,
  ageCoverage,
  clauseAssignment,
  mysticRestriction,
  genePoolAlleles,
  purposeDuplicates,
  voiceContract,
  frameShape,
];
