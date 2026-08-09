import type { Rng } from '../rng.js';

/**
 * Names are load-bearing in this world (concept §3). They are plain, slightly
 * archaic, and deliberately not fantasy-inflected — age is carried by content,
 * not by apostrophes.
 */
const MALE = [
  'Aldous', 'Bertram', 'Cadmon', 'Doran', 'Edric', 'Fenwick', 'Garrick', 'Halden',
  'Ivor', 'Jarret', 'Kelwin', 'Lorcan', 'Merrick', 'Nevin', 'Osric', 'Perrin',
  'Quenton', 'Roderic', 'Sildon', 'Thorne', 'Ulric', 'Varen', 'Wystan', 'Yardley',
];

const FEMALE = [
  'Alys', 'Bethen', 'Corwen', 'Dalia', 'Eilwen', 'Fenna', 'Gwenneth', 'Hesper',
  'Ilsa', 'Jorunn', 'Katrin', 'Lisbeth', 'Maura', 'Nessa', 'Orlaith', 'Perrine',
  'Quilla', 'Rhoswen', 'Sable', 'Tamsin', 'Ursel', 'Verity', 'Wilda', 'Ysolde',
];

export function givenName(sex: 'male' | 'female', rng: Rng): string {
  return rng.pick(sex === 'male' ? MALE : FEMALE);
}

/** Ordinals for the chronicle: "Edric, third of that name". */
export function ordinalSuffix(n: number): string {
  const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
  return words[n - 1] ?? `${n}th`;
}

export function uniqueName(sex: 'male' | 'female', taken: Set<string>, rng: Rng): string {
  const base = givenName(sex, rng);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10; n++) {
    const candidate = `${base} the ${ordinalSuffix(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} ${rng.int(999)}`;
}
