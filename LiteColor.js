/**
 * @zakkster/lite-color — OKLCH color interpolation for games and gradients
 *
 * Depends on @zakkster/lite-lerp for interpolation primitives.
 */

import { lerp, lerpAngle, clamp } from '@zakkster/lite-lerp';

/**
 * Linearly interpolates between two OKLCH colors.
 * Safely clamps Lightness (0–1) and prevents negative Chroma.
 *
 * @param {{ l: number, c: number, h: number }} a - Start color
 * @param {{ l: number, c: number, h: number }} b - End color
 * @param {number} t - Interpolation factor (0–1)
 */
export const lerpOklch = (a, b, t) => ({
    l: clamp(lerp(a.l, b.l, t), 0, 1),
    c: Math.max(0, lerp(a.c, b.c, t)),
    h: lerpAngle(a.h, b.h, t),
});

/**
 * Formats an OKLCH object into a browser-safe CSS string.
 * Uses fixed precision to prevent scientific notation bugs.
 *
 * @param {{ l: number, c: number, h: number, a?: number }} color
 */
export const toCssOklch = ({ l, c, h, a = 1 }) =>
    `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)} / ${a})`;

/**
 * Parse an OKLCH CSS string back to an object.
 * Handles: oklch(0.7 0.15 120), oklch(0.7 0.15 120 / 0.5)
 *
 * @param {string} str - CSS oklch() string
 * @returns {{ l: number, c: number, h: number, a: number }}
 */
export const parseOklch = (str) => {
    const match = str.match(
        /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/
    );
    if (!match) throw new Error(`lite-color: cannot parse "${str}"`);
    return {
        l: parseFloat(match[1]),
        c: parseFloat(match[2]),
        h: parseFloat(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    };
};

/**
 * Multi-stop gradient evaluation with optional easing.
 *
 * @param {Array} colors - Array of OKLCH color objects
 * @param {number} t - Progress (0–1)
 * @param {Function} [ease] - Optional easing function
 */
export const multiStopGradient = (colors, t, ease = (x) => x) => {
    if (!Array.isArray(colors) || colors.length === 0) {
        throw new Error("lite-color: colors array must contain at least 1 color");
    }
    if (colors.length === 1) return colors[0];

    const clampedT = clamp(ease(t), 0, 1);
    const scaledT = clampedT * (colors.length - 1);
    const index = Math.floor(scaledT);

    if (index >= colors.length - 1) return colors[colors.length - 1];

    const localT = scaledT - index;
    return lerpOklch(colors[index], colors[index + 1], localT);
};

/**
 * Creates a reusable gradient sampler function.
 *
 * @example
 * const heatmap = createGradient([cold, warm, hot], easeInOut);
 * const color = heatmap(0.5);
 */
export const createGradient = (colors, ease = (x) => x) => {
    if (!Array.isArray(colors) || colors.length === 0) {
        throw new Error("lite-color: colors array must contain at least 1 color");
    }
    return (t) => multiStopGradient(colors, t, ease);
};

/** Reverses a color array without mutating the original. */
export const reverseGradient = (colors) => [...colors].reverse();

/**
 * Picks a random color from anywhere along the gradient.
 * @param {Array} colors - The gradient array
 * @param {{ next: function(): number }} rng - An RNG with .next() returning [0, 1)
 */
export const randomFromGradient = (colors, rng) => {
    return multiStopGradient(colors, rng.next());
};
