import type { ContentBundle } from './content.js';
import type { EventTemplate } from './event.js';
import { FREQUENCY_PROFILES } from './frequency.js';
import { canLearn } from './attributes.js';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

/**
 * Content validation beyond what Zod can express. Errors block save; warnings
 * do not. Shared by the editor panel and CI so there is exactly one definition
 * of "valid".
 */
export function validateBundle(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  const eventIds = new Set<string>();
  const ageIds = new Set(b.ages.map((a) => a.id));
  const arcIds = new Set(b.arcs.map((a) => a.id));
  const knowledgeGranted = new Set<string>();

  for (const e of b.events) {
    for (const o of allOutcomes(e)) {
      for (const eff of o.effects) {
        if (eff.kind === 'knowledge' && eff.op === 'grant') knowledgeGranted.add(eff.flag);
      }
    }
    if (e.record?.options.record.grantsKnowledge) knowledgeGranted.add(e.record.options.record.grantsKnowledge);
  }

  for (const e of b.events) {
    const at = `event:${e.id}`;

    if (eventIds.has(e.id)) issues.push({ level: 'error', where: at, message: `duplicate event id` });
    eventIds.add(e.id);

    if (new Set(e.purposes).size !== 3) {
      issues.push({ level: 'error', where: at, message: 'three DISTINCT purposes required' });
    }

    // ── Frequency obligations ────────────────────────────────────────────
    const p = FREQUENCY_PROFILES[e.frequency];
    if (p.record === 'required' && !e.record) {
      issues.push({ level: 'error', where: at, message: `${e.frequency} events must carry a record block` });
    }
    if (p.record === 'forbidden' && e.record) {
      issues.push({ level: 'error', where: at, message: `common events must not carry a record block — the Record choice loses meaning if it is routine` });
    }
    if (p.rumour === 'always' && !e.rumour) {
      issues.push({ level: 'warning', where: at, message: `${e.frequency} events should seed a rumour — the world remembers events of this weight` });
    }
    if (p.rumour === 'never' && e.rumour) {
      issues.push({ level: 'warning', where: at, message: 'common events do not enter folklore' });
    }
    if (e.frequency === 'mythic' && e.repeatable) {
      issues.push({ level: 'error', where: at, message: 'a mythic event that can repeat is not mythic' });
    }
    if (p.named && e.accounts.length < 2) {
      issues.push({ level: 'warning', where: at, message: 'fewer than two contradicting accounts (concept §19)' });
    }

    // ── Slots ────────────────────────────────────────────────────────────
    const slotIds = new Set(Object.keys(e.slots));
    for (const token of e.body.matchAll(/\{([A-Z_][A-Z0-9_]*)\}/g)) {
      const name = token[1]!;
      if (!slotIds.has(name)) {
        issues.push({ level: 'error', where: at, message: `body references undefined slot {${name}}` });
      }
    }
    for (const [sid, spec] of Object.entries(e.slots)) {
      if (spec.bind === 'arc' && !e.arc) {
        issues.push({ level: 'warning', where: `${at}/${sid}`, message: 'arc-bound slot on an event that belongs to no arc' });
      }
      if (spec.bind === 'arc' && spec.onMissing === 'continue_absent' && !e.absentBody) {
        issues.push({ level: 'error', where: `${at}/${sid}`, message: 'continue_absent requires absentBody — otherwise this renders a token for a man forty years in the ground' });
      }
    }

    // ── Ages ─────────────────────────────────────────────────────────────
    for (const a of [...(e.ages?.only ?? []), ...(e.ages?.never ?? [])]) {
      if (!ageIds.has(a)) issues.push({ level: 'error', where: at, message: `unknown age '${a}'` });
    }

    // ── Effects ──────────────────────────────────────────────────────────
    for (const o of allOutcomes(e)) {
      const total = 0;
      for (const eff of o.effects) {
        if (eff.kind === 'arc' && !arcIds.has(eff.arc)) {
          issues.push({ level: 'error', where: `${at}/${o.id}`, message: `unknown arc '${eff.arc}'` });
        }
        if (eff.kind === 'madness' && eff.delta > 0) {
          const t = eff.target;
          const slot = typeof t === 'object' && 'slot' in t ? e.slots[t.slot] : undefined;
          const guarded = slot?.filters.some((f) => 'canExpress' in f && f.canExpress === true)
            || slot?.filters.some((f) => 'sex' in f && f.sex === 'male');
          if (!guarded) {
            issues.push({
              level: 'error',
              where: `${at}/${o.id}`,
              message: 'madness effect on a target not gated to canExpress — women and mundane men cannot go mad (concept §10)',
            });
          }
        }
      }
      void total;
    }

    // Outcome weights
    for (const group of outcomeGroups(e)) {
      const sum = group.reduce((s, o) => s + o.weight, 0);
      if (sum === 0) issues.push({ level: 'error', where: at, message: 'outcome weights sum to zero' });
      else if (sum !== 100) issues.push({ level: 'warning', where: at, message: `outcome weights sum to ${sum}, not 100` });
    }

    if (e.interaction.kind === 'choice' && e.interaction.choices.length < 2) {
      issues.push({ level: 'error', where: at, message: 'a choice event needs at least two options' });
    }
    if (e.body.split(/\s+/).length < 25) {
      issues.push({ level: 'warning', where: at, message: 'body under 25 words' });
    }

    issues.push(...proseIssues(at, e.body));
    if (e.absentBody) issues.push(...proseIssues(`${at}/absentBody`, e.absentBody));
  }

  // Knowledge conditions referencing flags nothing grants
  for (const e of b.events) {
    walkConditions(e.conditions, (c) => {
      if ('knowledge' in c && c.has === true && !knowledgeGranted.has(c.knowledge)) {
        issues.push({ level: 'error', where: `event:${e.id}`, message: `knowledge condition '${c.knowledge}' is granted by no event` });
      }
    });
  }

  // ── Per-Age coverage ───────────────────────────────────────────────────
  for (const age of b.ages) {
    const owned = b.events.filter((e) => e.ages?.only?.includes(age.id)).length;
    if (owned < 4) {
      issues.push({
        level: 'warning',
        where: `age:${age.id}`,
        message: `only ${owned} exclusive events — an Age with no content of its own is a modifier wearing a name`,
      });
    }
    if (age.clauseBearing && age.duration.medianYears < 25) {
      issues.push({ level: 'warning', where: `age:${age.id}`, message: 'clause-bearing Age with a short median span; consider clauseBearing: false' });
    }
  }

  // ── Arcs ───────────────────────────────────────────────────────────────
  for (const arc of b.arcs) {
    const nodeIds = new Set(arc.nodes.map((n) => n.id));
    if (!nodeIds.has(arc.entry)) issues.push({ level: 'error', where: `arc:${arc.id}`, message: `entry node '${arc.entry}' not found` });
    for (const n of arc.nodes) {
      if (!eventIds.has(n.event)) issues.push({ level: 'error', where: `arc:${arc.id}/${n.id}`, message: `unknown event '${n.event}'` });
      for (const s of n.successors) {
        if (s.to !== 'end' && !nodeIds.has(s.to)) {
          issues.push({ level: 'error', where: `arc:${arc.id}/${n.id}`, message: `successor '${s.to}' not found` });
        }
      }
    }
  }

  // ── Purpose duplicate sweep (editor brief §5.1) ────────────────────────
  const byPurpose = new Map<string, string[]>();
  for (const e of b.events) {
    const key = [...e.purposes].sort().join('+');
    byPurpose.set(key, [...(byPurpose.get(key) ?? []), e.id]);
  }
  for (const [key, ids] of byPurpose) {
    if (ids.length >= 3) {
      issues.push({ level: 'warning', where: 'purposes', message: `${ids.length} templates share all three purposes (${key}): ${ids.join(', ')}` });
    }
  }

  // ── Mystic restriction sanity ──────────────────────────────────────────
  for (const t of b.traits) {
    if (t.acquisition.kind === 'threshold') {
      const attr = t.acquisition.attr as unknown as string;
      if (!canLearn('female', attr) && t.tags.includes('female' as never)) {
        issues.push({ level: 'warning', where: `trait:${t.id}`, message: 'female-tagged trait keyed to an elemental affinity' });
      }
    }
  }

  return issues;
}

/**
 * THE VOICE CONTRACT, applied to anything long enough to have a shape.
 *
 * A body of five sentences or fewer is a note. Past that it is prose, and it
 * is held to `Writing/PatrickRothfussProse.md`. Most of that spec is judgement,
 * but a useful minority is countable, and the countable part is where
 * imitation usually fails — so count it.
 *
 * All warnings, never errors. A linter that blocks writers gets disabled
 * within a fortnight. The value is that a body failing four of these at once
 * is genuinely off-voice, and the panel makes that visible in a way a style
 * guide in another folder never will.
 */
export const PROSE_SENTENCE_THRESHOLD = 5;

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function proseIssues(where: string, body: string): Issue[] {
  const out: Issue[] = [];
  const sentences = splitSentences(body);
  if (sentences.length <= PROSE_SENTENCE_THRESHOLD) return out;

  const words = body.split(/\s+/).filter(Boolean);
  const lens = sentences.map((s) => s.split(/\s+/).length);
  const warn = (message: string) => out.push({ level: 'warning', where, message });

  // Strong verbs over verb+adverb (prose spec §5.2)
  const adverbs = words.filter((w) => /ly[.,;:!?"']*$/i.test(w) && w.length > 5).length;
  if (adverbs / words.length > 0.025) {
    warn(`adverb density ${(100 * adverbs / words.length).toFixed(1)}% — strong verbs over verb+adverb`);
  }

  // The jagged profile: long, long, short (§2.1-2.3)
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
  if (sd < 5) warn(`flat rhythm (sentence-length sd ${sd.toFixed(1)}) — vary the cadence`);

  // Paragraphs land on a short sentence (§2.1)
  const last = lens[lens.length - 1]!;
  if (last > 12) warn(`no landing — final sentence is ${last} words; land on something short`);

  // Never explain the punch line (§2.1)
  if (lens.length >= 2 && last <= 12 && lens[lens.length - 2]! <= 12) {
    warn('explained landing — two short closers in a row; cut one');
  }

  // Age is carried by content, not grammar (§5.4)
  const archaic = body.match(/\b(ere|mayhap|betwixt|whilst|'twas|forsooth|verily)\b/gi);
  if (archaic) warn(`archaism: ${[...new Set(archaic.map((a) => a.toLowerCase()))].join(', ')}`);

  // Sound and temperature before sight (§7)
  const first = sentences[0]!.toLowerCase();
  const visual = /\b(saw|looked|bright|dark|colour|color|gleam|shone|visible)\b/.test(first);
  const sensed = /\b(cold|warm|heat|quiet|loud|silence|smell|sound|damp|dry|still)\b/.test(first);
  if (visual && !sensed) warn('sight-first opening — reach for sound or temperature before sight');

  // A slot token in the landing breaks the close on some fills (§16.1)
  if (/\{[A-Z_][A-Z0-9_]*\}/.test(sentences[sentences.length - 1]!)) {
    warn('variable in the landing — a five-syllable name destroys a four-beat close');
  }

  return out;
}

function allOutcomes(e: EventTemplate) {
  return outcomeGroups(e).flat();
}

function outcomeGroups(e: EventTemplate) {
  if (e.interaction.kind === 'narration') return [e.interaction.outcomes];
  return e.interaction.choices.map((c) => c.outcomes);
}

function walkConditions(c: unknown, fn: (c: any) => void): void {
  if (!c || typeof c !== 'object') return;
  const o = c as any;
  fn(o);
  if (Array.isArray(o.all)) o.all.forEach((x: unknown) => walkConditions(x, fn));
  if (Array.isArray(o.any)) o.any.forEach((x: unknown) => walkConditions(x, fn));
  if (o.not) walkConditions(o.not, fn);
}
