import { describe, expect, it } from 'vitest';
import { loadBundle } from '@ed/content';
import type { ContentBundle, EventTemplate } from '@ed/schema';
import { desugarInline, indexContent, isInlineArcId } from '@ed/schema';

const base = loadBundle();

/**
 * INLINE FOLLOW-UPS (`Outcome.next`), compiled to arcs.
 *
 * The property under test is not "it produces an arc" but the two that keep
 * this from becoming a second branching system: what it compiles is a REAL
 * `ArcDef` the ordinary runtime advances, and it compiles into the INDEX and
 * never into the bundle — so the editor's write-back cannot serialise a
 * compiled arc back into somebody's YAML.
 */

/** A narration event with one outcome, named. */
function beat(id: string, slots: string[] = []): EventTemplate {
  return {
    id,
    title: id,
    tier: 'family',
    frequency: 'uncommon',
    weight: 100,
    repeatable: true,
    cooldownYears: 0,
    tags: [],
    purposes: ['change_standing', 'change_relationship', 'buy_patience'],
    slots: Object.fromEntries(slots.map((s) => [s, { role: 'family_member', castBy: 'engine', optional: false, filters: [], bind: 'event' }])),
    checks: [],
    reads: [],
    body: 'A body long enough to be a body and not a note, which the shape rule asks for.',
    accounts: [],
    interaction: {
      kind: 'narration',
      outcomes: [{ id: `${id}_done`, weight: 100, text: 'And so.', tags: [], effects: [] }],
    },
  } as EventTemplate;
}

function link(e: EventTemplate, to: string, keep: string[] = []): EventTemplate {
  if (e.interaction.kind !== 'narration') throw new Error('unreachable');
  e.interaction.outcomes[0]!.next = { event: to, after: 'immediate', keep };
  return e;
}

const bundleOf = (events: EventTemplate[]): ContentBundle =>
  ({ ...base, events: [...base.events, ...events] }) as ContentBundle;

describe('desugarInline', () => {
  it('compiles one link into an arc whose entry is the follow-up', () => {
    const first = link(beat('t_first'), 't_second');
    const out = desugarInline([first, beat('t_second')], []);

    expect(out.arcs).toHaveLength(1);
    const arc = out.arcs[0]!;
    expect(isInlineArcId(arc.id)).toBe(true);
    expect(arc.inline).toBe(true);
    expect(arc.entry).toBe('t_second');
    expect(arc.nodes.map((n) => n.event)).toEqual(['t_second']);
  });

  it('leaves the root firing ambiently and takes the follow-up out of the pool', () => {
    // The asymmetry is the design: the first beat is an event, and everything
    // after it is a consequence. `ambientPool` skips anything with an `arc`.
    const out = desugarInline([link(beat('t_first'), 't_second'), beat('t_second')], []);
    const byId = new Map(out.events.map((e) => [e.id, e]));
    expect(byId.get('t_first')!.arc).toBeUndefined();
    expect(byId.get('t_second')!.arc).toEqual({ of: out.arcs[0]!.id, node: 't_second' });
  });

  it('gives the root outcome the triggers that start the arc', () => {
    const out = desugarInline([link(beat('t_first'), 't_second'), beat('t_second')], []);
    const root = out.events.find((e) => e.id === 't_first')!;
    if (root.interaction.kind !== 'narration') throw new Error('unreachable');
    expect(root.interaction.outcomes[0]!.triggers).toEqual({ arc: out.arcs[0]!.id, op: 'start' });
  });

  it('compiles a three-long chain into ONE arc with three nodes', () => {
    const out = desugarInline(
      [link(beat('t_a'), 't_b'), link(beat('t_b'), 't_c'), link(beat('t_c'), 't_d'), beat('t_d')],
      [],
    );
    expect(out.arcs).toHaveLength(1);
    expect(out.arcs[0]!.nodes.map((n) => n.id)).toEqual(['t_b', 't_c', 't_d']);
    expect(out.arcs[0]!.nodes[0]!.successors[0]).toMatchObject({ to: 't_c' });
    expect(out.arcs[0]!.nodes[2]!.successors[0]).toMatchObject({ to: 'end' });
  });

  it('carries `keep` through as the arc\'s persistent bindings', () => {
    // Which is the whole reason this exists rather than a `schedule` effect:
    // the follow-up is about the same person.
    const out = desugarInline([link(beat('t_first', ['RIVAL']), 't_second', ['RIVAL']), beat('t_second', ['RIVAL'])], []);
    expect(out.arcs[0]!.bindings).toEqual(['RIVAL']);
  });

  it('does not place an event twice when a chain loops', () => {
    const out = desugarInline([link(beat('t_x'), 't_y'), link(beat('t_y'), 't_y')], []);
    expect(out.arcs[0]!.nodes).toHaveLength(1);
    expect(out.arcs[0]!.nodes[0]!.successors[0]).toMatchObject({ to: 't_y' });
  });

  it('drops a link naming an event that does not exist rather than compiling a dangling node', () => {
    // `arcs/wiring` is what reports it. Compiling the node anyway would give
    // the arc a node whose event `mustEvent` throws on, mid-run.
    const out = desugarInline([link(beat('t_only'), 'not_a_real_event')], []);
    expect(out.arcs).toHaveLength(0);
  });

  it('compiles nothing for a chain that is wholly a cycle', () => {
    // Nothing leads into it, so nothing can start it. `arcs/inline` says so;
    // compiling an arc no event triggers would only hide that.
    const out = desugarInline([link(beat('t_p'), 't_q'), link(beat('t_q'), 't_p')], []);
    expect(out.arcs).toHaveLength(0);
  });

  it('is idempotent — compiling twice does not start the same story twice', () => {
    // `indexContent` is called on the same content in a dozen places, and two
    // arcs racing to tell one story is not a failure anyone would trace back.
    const events = [link(beat('t_first'), 't_second'), beat('t_second')];
    const once = desugarInline(events, []);
    const twice = desugarInline(once.events, once.arcs);
    expect(twice.arcs).toHaveLength(1);
    expect(twice.arcs.map((a) => a.id)).toEqual(once.arcs.map((a) => a.id));
  });

  it('does nothing at all to content with no inline links', () => {
    const out = desugarInline(base.events, base.arcs);
    expect(out.events).toBe(base.events);
    expect(out.arcs).toBe(base.arcs);
  });
});

describe('indexContent', () => {
  it('compiles into the index and leaves the authored bundle untouched', () => {
    // The line that stops the editor writing a compiled arc back to disk.
    const b = bundleOf([link(beat('t_first'), 't_second'), beat('t_second')]);
    const authoredArcs = b.arcs.length;
    const content = indexContent(b);

    expect(content.arcs.length).toBe(authoredArcs + 1);
    expect(content.bundle.arcs.length).toBe(authoredArcs);
    expect(content.bundle.events.find((e) => e.id === 't_second')!.arc).toBeUndefined();
    expect(content.event('t_second')!.arc).toBeDefined();
  });

  it('makes the compiled arc reachable by id, the way any other arc is', () => {
    const content = indexContent(bundleOf([link(beat('t_first'), 't_second'), beat('t_second')]));
    const arc = content.arcs.find((a) => a.inline)!;
    expect(content.arc(arc.id)).toBe(arc);
    expect(() => content.mustArc(arc.id)).not.toThrow();
  });
});
