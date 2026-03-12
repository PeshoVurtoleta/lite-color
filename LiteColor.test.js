import { describe, it, expect, vi } from 'vitest';

// Mock the lite-lerp dependency with actual implementations
vi.mock('@zakkster/lite-lerp', () => ({
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    lerp: (a, b, t) => a + (b - a) * t,
    lerpAngle: (a, b, t) => {
        const delta = ((b - a + 540) % 360) - 180;
        return a + delta * t;
    },
}));

import {
    lerpOklch, toCssOklch, parseOklch,
    multiStopGradient, createGradient,
    reverseGradient, randomFromGradient
} from './LiteColor.d.ts';

const red   = { l: 0.6, c: 0.25, h: 30 };
const blue  = { l: 0.5, c: 0.20, h: 260 };
const green = { l: 0.8, c: 0.18, h: 145 };

describe('🎨 lite-color', () => {

    describe('lerpOklch()', () => {
        it('returns start color at t=0', () => {
            const result = lerpOklch(red, blue, 0);
            expect(result.l).toBeCloseTo(red.l);
            expect(result.c).toBeCloseTo(red.c);
            expect(result.h).toBeCloseTo(red.h);
        });

        it('returns end color at t=1', () => {
            const result = lerpOklch(red, blue, 1);
            expect(result.l).toBeCloseTo(blue.l);
            expect(result.c).toBeCloseTo(blue.c);
        });

        it('interpolates at t=0.5', () => {
            const result = lerpOklch(red, blue, 0.5);
            expect(result.l).toBeCloseTo(0.55);
            expect(result.c).toBeCloseTo(0.225);
        });

        it('clamps lightness to [0, 1]', () => {
            const dark = { l: -0.5, c: 0.1, h: 0 };
            const bright = { l: 1.5, c: 0.1, h: 0 };
            expect(lerpOklch(dark, bright, 0).l).toBe(0);
            expect(lerpOklch(dark, bright, 1).l).toBe(1);
        });

        it('prevents negative chroma', () => {
            const a = { l: 0.5, c: 0.01, h: 0 };
            const b = { l: 0.5, c: -0.1, h: 0 };
            expect(lerpOklch(a, b, 1).c).toBe(0);
        });

        it('uses shortest-path hue interpolation', () => {
            const a = { l: 0.5, c: 0.1, h: 350 };
            const b = { l: 0.5, c: 0.1, h: 10 };
            const mid = lerpOklch(a, b, 0.5);
            const normalized = ((mid.h % 360) + 360) % 360;
            expect(normalized).toBeCloseTo(0);
        });
    });

    describe('toCssOklch()', () => {
        it('formats standard color', () => {
            const css = toCssOklch({ l: 0.7, c: 0.15, h: 120 });
            expect(css).toBe('oklch(0.7000 0.1500 120.00 / 1)');
        });

        it('includes alpha when provided', () => {
            const css = toCssOklch({ l: 0.5, c: 0.1, h: 60, a: 0.5 });
            expect(css).toContain('/ 0.5');
        });

        it('defaults alpha to 1', () => {
            const css = toCssOklch({ l: 0.5, c: 0.1, h: 60 });
            expect(css).toContain('/ 1');
        });

        it('uses fixed precision (no scientific notation)', () => {
            const css = toCssOklch({ l: 0.0001, c: 0.0001, h: 0.01 });
            expect(css).not.toContain('e');
        });
    });

    describe('parseOklch()', () => {
        it('parses standard oklch string', () => {
            const result = parseOklch('oklch(0.7 0.15 120)');
            expect(result.l).toBeCloseTo(0.7);
            expect(result.c).toBeCloseTo(0.15);
            expect(result.h).toBeCloseTo(120);
            expect(result.a).toBe(1);
        });

        it('parses oklch with alpha', () => {
            const result = parseOklch('oklch(0.5 0.1 60 / 0.5)');
            expect(result.a).toBeCloseTo(0.5);
        });

        it('round-trips through toCssOklch', () => {
            const original = { l: 0.7123, c: 0.1567, h: 123.45, a: 0.8 };
            const css = toCssOklch(original);
            const parsed = parseOklch(css);
            expect(parsed.l).toBeCloseTo(original.l, 3);
            expect(parsed.c).toBeCloseTo(original.c, 3);
            expect(parsed.h).toBeCloseTo(original.h, 1);
        });

        it('throws on invalid string', () => {
            expect(() => parseOklch('rgb(255, 0, 0)')).toThrow(/cannot parse/);
        });
    });

    describe('multiStopGradient()', () => {
        const stops = [red, green, blue];

        it('returns first color at t=0', () => {
            const result = multiStopGradient(stops, 0);
            expect(result.l).toBeCloseTo(red.l);
        });

        it('returns last color at t=1', () => {
            const result = multiStopGradient(stops, 1);
            expect(result.l).toBeCloseTo(blue.l);
        });

        it('interpolates between stops', () => {
            const result = multiStopGradient(stops, 0.5);
            expect(result.l).toBeCloseTo(green.l);
        });

        it('returns single color for 1-element array', () => {
            const result = multiStopGradient([red], 0.5);
            expect(result).toBe(red);
        });

        it('throws on empty array', () => {
            expect(() => multiStopGradient([], 0.5)).toThrow(/at least 1/);
        });

        it('accepts custom easing', () => {
            const easeIn = (t) => t * t;
            const linear = multiStopGradient(stops, 0.5);
            const eased = multiStopGradient(stops, 0.5, easeIn);
            // easeIn(0.5) = 0.25, so eased should be closer to the first color
            expect(eased.l).toBeGreaterThan(linear.l - 0.3);
        });

        it('clamps t to [0, 1]', () => {
            const result = multiStopGradient(stops, 1.5);
            expect(result.l).toBeCloseTo(blue.l);
        });
    });

    describe('createGradient()', () => {
        it('returns a sampler function', () => {
            const sampler = createGradient([red, blue]);
            expect(sampler).toBeTypeOf('function');
        });

        it('sampler returns interpolated colors', () => {
            const sampler = createGradient([red, blue]);
            const mid = sampler(0.5);
            expect(mid.l).toBeCloseTo(0.55);
        });

        it('throws on empty array', () => {
            expect(() => createGradient([])).toThrow(/at least 1/);
        });

        it('accepts easing function', () => {
            const easeIn = (t) => t * t;
            const sampler = createGradient([red, blue], easeIn);
            const result = sampler(0.5);
            expect(result).toBeDefined();
        });
    });

    describe('reverseGradient()', () => {
        it('returns reversed copy', () => {
            const original = [red, green, blue];
            const reversed = reverseGradient(original);
            expect(reversed[0]).toBe(blue);
            expect(reversed[2]).toBe(red);
        });

        it('does not mutate original', () => {
            const original = [red, green, blue];
            reverseGradient(original);
            expect(original[0]).toBe(red);
        });
    });

    describe('randomFromGradient()', () => {
        it('returns a color from the gradient', () => {
            const rng = { next: () => 0.5 };
            const result = randomFromGradient([red, blue], rng);
            expect(result.l).toBeCloseTo(0.55);
        });

        it('uses rng.next() for sampling', () => {
            const rng = { next: () => 0 };
            const result = randomFromGradient([red, blue], rng);
            expect(result.l).toBeCloseTo(red.l);
        });
    });
});
