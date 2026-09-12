/**
 * WHERE THE NEEDLE SITS ON THE RULE (issue #51).
 *
 * `assize.pressure` runs from −1 — the world can see the house is failing and
 * is steadying it — to 1, where it can see the house is ahead and is charging
 * it for that. The header read only `arm`, which is that number thresholded to
 * three words, so a house at 0.15 and a house at 0.95 got the same sentence
 * right up until the exaction landed. Invariant 13 is that the world reacts
 * AND SAYS SO; half the reading not being drawn is half the point removed.
 *
 * This is a pure function with a test rather than an expression inside a
 * template because of the one way a gauge fails silently: drawn with the sign
 * flipped it looks entirely plausible in every screenshot, moves when the
 * player expects movement, and is wrong every single time. Nothing about the
 * rendered page would ever say so.
 *
 * Left is the world steadying you, right is the world charging you — the same
 * order as the number, which is the whole claim being made.
 */
export function needleAt(pressure: number): number {
  // Clamped rather than trusted: the view rounds `pressure` but nothing
  // promises the engine keeps it inside the range, and a needle that leaves
  // its own rule is a worse bug than one that pins to the end of it.
  const held = Math.max(-1, Math.min(1, Number.isFinite(pressure) ? pressure : 0));
  return (held + 1) * 50;
}
