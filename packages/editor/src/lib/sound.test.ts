import { describe, expect, it } from 'vitest';
import { RegisterS, type Register } from '@ed/schema';
import { CUES, PEAK, cueScore, droneScore, type Cue, type Score } from './sound';

/**
 * Sound fails silently — that is not a pun, it is the whole problem. A cue
 * whose gain is zero, a voice above the range of a laptop speaker, a decay of
 * zero seconds: every one of them is a cue that plays nothing, and nothing is
 * exactly what a working cue that nobody triggered also plays.
 *
 * So these assert the shape of a healthy sound design rather than that the
 * functions returned something. None of them constructs an `AudioContext`;
 * everything worth checking is in the description.
 */

const peakOf = (s: Score) => s.voices.reduce((a, v) => a + v.gain, 0);
const endOf = (s: Score) => Math.max(...s.voices.map((v) => v.delay + v.attack + v.decay));

describe('every cue makes a sound', () => {
  it.each(CUES)('%s has voices, and all of them are audible', (cue) => {
    const score = cueScore(cue);
    expect(score.voices.length, `${cue} has no voices`).toBeGreaterThan(0);
    for (const v of score.voices) {
      expect(v.gain, `${cue}: a voice at zero gain plays nothing`).toBeGreaterThan(0);
      expect(v.decay, `${cue}: a voice with no decay never sounds`).toBeGreaterThan(0);
      // 40Hz is about where a laptop speaker gives up; 12kHz is where the
      // sound stops being a sound and starts being a complaint.
      expect(v.freq, `${cue}: ${v.freq}Hz is below anything that will play`).toBeGreaterThan(30);
      expect(v.freq, `${cue}: ${v.freq}Hz is too high to be a cue`).toBeLessThan(12000);
    }
  });

  it.each(CUES)('%s stays under the peak', (cue) => {
    expect(peakOf(cueScore(cue)), `${cue} is too loud`).toBeLessThanOrEqual(PEAK);
  });

  /**
   * §24's word is "sparse". A cue that rings for three seconds while the
   * player is holding down "+25 years" is a cue that overlaps itself twelve
   * times, and the bell is the only one allowed any tail at all.
   */
  it.each(CUES)('%s is over quickly', (cue) => {
    const limit = cue === 'bell' ? 3 : 1.2;
    expect(endOf(cueScore(cue)), `${cue} outstays its welcome`).toBeLessThanOrEqual(limit);
  });

  it('no cue sustains — only the drone holds', () => {
    for (const cue of CUES) expect(cueScore(cue).sustain, cue).toBeFalsy();
  });
});

describe('the three valences are three different sounds', () => {
  /**
   * The bug this is written for: `boon` and `blow` returning the same score,
   * which looks completely correct in every view and makes the whole valence
   * system a no-op you cannot hear.
   */
  it('boon, blow and plain are all distinct', () => {
    const [boon, blow, plain] = ['boon', 'blow', 'plain'].map((c) => JSON.stringify(cueScore(c as Cue)));
    expect(boon).not.toBe(blow);
    expect(boon).not.toBe(plain);
    expect(blow).not.toBe(plain);
  });

  /** The mechanism, not a fixed frequency: a boon goes up. */
  it('the boon rises and the blow falls', () => {
    const boon = cueScore('boon').voices;
    const first = boon[0]!;
    const later = boon.find((v) => v.delay > first.delay);
    expect(later, 'the boon has only one note, so it has no direction').toBeDefined();
    expect(later!.freq, 'the boon does not rise').toBeGreaterThan(first.freq);

    for (const v of cueScore('blow').voices) {
      if (v.toFreq !== undefined) expect(v.toFreq, 'the blow does not fall').toBeLessThan(v.freq);
    }
  });

  /**
   * The house takes far more blows than boons over a thousand years. A failure
   * chime louder than the success chime turns the run into a scolding.
   */
  it('the blow is not the louder of the two', () => {
    expect(peakOf(cueScore('blow'))).toBeLessThanOrEqual(peakOf(cueScore('boon')));
  });

  /** The commonest cue in the run, so it has to be the smallest. */
  it('the plain note is the quietest and shortest thing here', () => {
    const plain = cueScore('plain');
    expect(plain.voices).toHaveLength(1);
    for (const cue of CUES) {
      if (cue === 'plain') continue;
      expect(peakOf(plain), `plain is louder than ${cue}`).toBeLessThan(peakOf(cueScore(cue)));
    }
  });
});

describe('the drone shifts by Age', () => {
  const registers = RegisterS.options;

  it('is a real drone: low, held, and swelling rather than struck', () => {
    const score = droneScore({ registers: ['warm'], frame: false })!;
    expect(score.sustain).toBe(true);
    for (const v of score.voices) {
      expect(v.freq, `${v.freq}Hz is not a drone`).toBeLessThan(200);
      expect(v.attack, 'a drone that starts instantly is a bang').toBeGreaterThan(1);
    }
  });

  /**
   * If two registers produce the same voices, the drone does not shift by Age
   * — and nothing anywhere would report that, because it would still hum.
   */
  it('every register sounds different from every other', () => {
    const heard = new Map<string, Register>();
    for (const r of registers) {
      const key = JSON.stringify(droneScore({ registers: [r], frame: false }));
      const clash = heard.get(key);
      expect(clash, `${r} and ${clash} are the same drone`).toBeUndefined();
      heard.set(key, r);
    }
    expect(heard.size).toBe(registers.length);
  });

  it('the root is there with no Age running, and it is only the root', () => {
    const quiet = droneScore({ registers: [], frame: false })!;
    const one = droneScore({ registers: ['cold'], frame: false })!;
    expect(quiet.voices.length).toBeGreaterThan(0);
    expect(one.voices.length, 'an Age adds nothing to the drone')
      .toBeGreaterThan(quiet.voices.length);
  });

  /** Overlapping Ages stack. Three at once should sound like three at once. */
  it('stacks, and each further Age is quieter than the last', () => {
    const three = droneScore({ registers: ['warm', 'cold', 'institutional'], frame: false })!;
    const one = droneScore({ registers: ['warm'], frame: false })!;
    expect(three.voices.length).toBeGreaterThan(one.voices.length);

    const added = three.voices.slice(2).filter((_, i) => i % 2 === 0);
    for (let i = 1; i < added.length; i++) {
      expect(added[i]!.gain, 'a later Age is not quieter').toBeLessThan(added[i - 1]!.gain);
    }
  });

  it('stays under the peak however many Ages are running', () => {
    const many: Register[] = ['warm', 'cold', 'institutional', 'cold', 'warm'];
    expect(peakOf(droneScore({ registers: many, frame: false })!)).toBeLessThanOrEqual(PEAK);
  });

  /** §24: the frame "kills the drone entirely". Not ducks it. Kills it. */
  it('the frame is silent', () => {
    expect(droneScore({ registers: ['warm', 'cold'], frame: true })).toBeNull();
    expect(droneScore({ registers: [], frame: true })).toBeNull();
  });
});
