/**
 * Generates packages/content/loci.yaml.
 *
 * The locus table is a tuning surface, not prose — it is generated so that
 * changing "how many loci feed Strength" is one number rather than forty lines
 * of hand-edited YAML. Re-run with:  node packages/content/tools/gen-loci.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CORE = ['strength', 'charm', 'agility', 'mind'];
const ELEMENTAL = ['fluid', 'thermal', 'aero', 'terra'];
const THRESHOLD = ['life', 'death', 'light', 'darkness'];
const AFFINITIES = [...ELEMENTAL, ...THRESHOLD];

const LOCI_PER_CORE = 6;
const LOCI_PER_AFFINITY = 3;
const FONT_LOCI = 6;
const CHANNEL_LOCI = 8;

/** The founder's own curses. Named, so discovering one is chronicle content. */
const DELETERIOUS = [
  { id: 'del_ashen_mark', name: 'the Ashen mark', lethal: false },
  { id: 'del_fourth_son_sleep', name: 'the fourth-son sleep', lethal: true },
  { id: 'del_winter_cough', name: 'the winter cough', lethal: false },
  { id: 'del_thin_bone', name: 'thin bone', lethal: false },
];

const loci = [];
let chromosome = 0;
let position = 0;

const nextChromosome = () => { chromosome += 1; position = 0; };
const nextPosition = (gap = 14) => { position += gap; return position; };

// ── Core attributes: polygenic, spread across two chromosomes each ─────────
for (const attr of CORE) {
  nextChromosome();
  for (let i = 0; i < LOCI_PER_CORE; i++) {
    const major = i === LOCI_PER_CORE - 1;
    loci.push({
      id: `${attr}_${i + 1}`,
      chromosome,
      position: nextPosition(major ? 9 : 16),
      kind: major ? 'major' : 'additive',
      dominance: major ? 0.55 : Number((Math.sin(i * 2.1) * 0.3).toFixed(2)),
      contributes: [{ attr, weight: major ? 2.6 : 1.4 }],
      alleles: major
        ? [
            { id: `${attr}_${i + 1}_null`, effect: 0, p: 0.86, tags: [] },
            { id: `${attr}_${i + 1}_gift`, effect: 9, p: 0.09, tags: [] },
            { id: `${attr}_${i + 1}_ruin`, effect: -6, p: 0.05, tags: [] },
          ]
        : [
            { id: `${attr}_${i + 1}_a`, effect: 0, p: 0.34, tags: [] },
            { id: `${attr}_${i + 1}_b`, effect: 3, p: 0.34, tags: [] },
            { id: `${attr}_${i + 1}_c`, effect: 6, p: 0.22, tags: [] },
            { id: `${attr}_${i + 1}_d`, effect: 9, p: 0.10, tags: [] },
          ],
    });
  }
}

// ── Affinities: sparse by design. A common null at high frequency means most
//    characters are zero in most affinities and nonzero needs a rare allele.
for (const aff of AFFINITIES) {
  nextChromosome();
  for (let i = 0; i < LOCI_PER_AFFINITY; i++) {
    loci.push({
      id: `${aff}_${i + 1}`,
      chromosome,
      position: nextPosition(20),
      kind: 'additive',
      dominance: -0.4,
      contributes: [{ attr: aff, weight: 3.2 }],
      alleles: [
        { id: `${aff}_${i + 1}_null`, effect: 0, p: 0.82, tags: ['null'] },
        { id: `${aff}_${i + 1}_trace`, effect: 4, p: 0.12, tags: [] },
        { id: `${aff}_${i + 1}_strong`, effect: 11, p: 0.06, tags: [] },
      ],
    });
  }
}

// ── Eldritch channel: autosomal, present worldwide, correlated with Mind ──
nextChromosome();
for (let i = 0; i < CHANNEL_LOCI; i++) {
  loci.push({
    id: `channel_${i + 1}`,
    chromosome,
    position: nextPosition(12),
    kind: 'eldritch_channel',
    dominance: 0.2,
    contributes: i % 2 === 0 ? [{ attr: 'mind', weight: 0.55 }] : [],
    alleles: [
      { id: `channel_${i + 1}_none`, effect: 0, p: 0.44, tags: [] },
      { id: `channel_${i + 1}_low`, effect: 2, p: 0.34, tags: [] },
      { id: `channel_${i + 1}_high`, effect: 5, p: 0.22, tags: [] },
    ],
  });
}

// ── Deleterious recessives: harmless heterozygous, costly homozygous. ─────
//    Inbreeding depression is not a penalty bolted on; it is this, plus maths.
nextChromosome();
for (const d of DELETERIOUS) {
  loci.push({
    id: d.id,
    chromosome,
    position: nextPosition(25),
    kind: 'deleterious',
    dominance: -1,
    contributes: [{ attr: 'strength', weight: -0.5 }],
    alleles: [
      { id: `${d.id}_clean`, effect: 0, p: 0.93, tags: [] },
      {
        id: `${d.id}_bad`,
        effect: -7,
        p: 0.07,
        name: d.name,
        tags: d.lethal ? ['deleterious', 'lethal_homozygous'] : ['deleterious'],
      },
    ],
  });
}

// ── Eldritch font: X-LINKED and family-exclusive. ─────────────────────────
//    Outsider genomes carry nulls here. This single fact is the whole of
//    "dilutes when married outward and cannot be replaced from any external
//    source" — and it is why a son's font comes only from his mother.
for (let i = 0; i < FONT_LOCI; i++) {
  loci.push({
    id: `font_${i + 1}`,
    chromosome: 'X',
    position: 18 * (i + 1),
    kind: 'eldritch_font',
    dominance: 0.35,
    contributes: [],
    alleles: [
      { id: `font_${i + 1}_null`, effect: 0, p: 0.88, tags: ['null'] },
      { id: `font_${i + 1}_faint`, effect: 2, p: 0.06, tags: ['eldritch'] },
      { id: `font_${i + 1}_deep`, effect: 6, p: 0.04, tags: ['eldritch'] },
      { id: `font_${i + 1}_burning`, effect: 11, p: 0.02, tags: ['eldritch'] },
    ],
  });
}

// A couple of X-linked core loci, so the X is not purely the font.
loci.push({
  id: 'charm_x1',
  chromosome: 'X',
  position: 130,
  kind: 'additive',
  dominance: 0.1,
  contributes: [{ attr: 'charm', weight: 1.2 }],
  alleles: [
    { id: 'charm_x1_a', effect: 0, p: 0.5, tags: [] },
    { id: 'charm_x1_b', effect: 5, p: 0.5, tags: [] },
  ],
});

const yaml = [
  '# GENERATED FILE — edit tools/gen-loci.mjs and re-run, do not hand-edit.',
  '#',
  '# Genotype and phenotype are separate layers. Characters do not inherit',
  '# stats; they inherit alleles. Regression to the mean, silent recessives,',
  '# throwbacks, dilution by outward marriage and madness from concentration',
  '# are all consequences of this table plus one pass of meiosis.',
  'loci:',
];

for (const l of loci) {
  yaml.push(`  - id: ${l.id}`);
  yaml.push(`    chromosome: ${typeof l.chromosome === 'string' ? `'${l.chromosome}'` : l.chromosome}`);
  yaml.push(`    position: ${l.position}`);
  yaml.push(`    kind: ${l.kind}`);
  yaml.push(`    dominance: ${l.dominance}`);
  if (l.contributes.length) {
    yaml.push('    contributes:');
    for (const c of l.contributes) yaml.push(`      - { attr: ${c.attr}, weight: ${c.weight} }`);
  } else {
    yaml.push('    contributes: []');
  }
  yaml.push('    alleles:');
  for (const a of l.alleles) {
    const tags = `[${a.tags.map((t) => `'${t}'`).join(', ')}]`;
    const name = a.name ? `, name: '${a.name}'` : '';
    yaml.push(`      - { id: ${a.id}, effect: ${a.effect}, p: ${a.p}, tags: ${tags}${name} }`);
  }
}

const out = fileURLToPath(new URL('../loci.yaml', import.meta.url));
writeFileSync(out, yaml.join('\n') + '\n', 'utf8');
console.log(`wrote ${loci.length} loci to ${out}`);
