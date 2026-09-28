import { EMOJI_GROUPS } from "./emoji.js";

// The list ships every emoji Unicode defines, but a machine only draws the
// ones its font actually has. Anything else comes out as a tofu box, or as
// several glyphs where a sequence failed to join, so both are measured out.
const measureAll = () => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) return null;

  ctx.font = "32px sans-serif";

  // an unassigned codepoint always lands on the missing-glyph box
  const tofu = ctx.measureText("\u{10FFFF}").width;
  // a plain emoji everything has, as the yardstick for a single glyph
  const single = ctx.measureText("\u{1F600}").width;
  if (!tofu || !single) return null;

  return (emoji) => {
    const width = ctx.measureText(emoji).width;

    // drawn as the missing-glyph box
    if (Math.abs(width - tofu) < 0.5) return false;
    // a sequence the font could not join falls apart into several glyphs
    return width <= single * 1.5;
  };
};

let cached = null;

// resolved once per page: walking two thousand glyphs is cheap, doing it on
// every keystroke would not be
export const getSupportedEmoji = () => {
  if (cached) return cached;

  const canRender = measureAll();

  cached = EMOJI_GROUPS.map((group) => ({
    name: group.name,
    // without a canvas we cannot tell, so show everything rather than nothing
    emojis: canRender
      ? group.emojis.filter(([glyph]) => canRender(glyph))
      : group.emojis,
  })).filter((group) => group.emojis.length > 0);

  return cached;
};

const RECENT_KEY = "recentEmoji";
const RECENT_LIMIT = 24;

export const readRecentEmoji = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

export const rememberEmoji = (emoji) => {
  const next = [emoji, ...readRecentEmoji().filter((e) => e !== emoji)].slice(
    0,
    RECENT_LIMIT,
  );

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // a browser with storage switched off simply forgets between sessions
  }
  return next;
};
