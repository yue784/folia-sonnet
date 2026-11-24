import React, { useEffect, useRef } from 'react';
import type { MotionValue } from 'framer-motion';
import type { Theme } from '../../../../types';

// src/components/visualizer/backgrounds/phigros/VisualizerPhigrosBackground.tsx
// Phigros-style falling-note chart background. The background contract has no
// lyric clock, so the chart runs on its own continuous timeline: notes spawn on
// a seeded rhythm, fall onto a judgment line that tilts and shifts over time,
// and the line glows with the audio power. Pure Canvas2D, no assets.

const TAU = Math.PI * 2;

interface BackgroundNote {
    lane: number;
    kind: 'tap' | 'hold';
    spawn: number;   // seconds on the background clock when it starts falling
    approach: number; // seconds until the head reaches the judgment line
    hold: number;    // extra seconds a hold stays after the head arrives (0 for tap)
    color: number;   // fill colour index
}

interface SegmentPose {
    angle: number;   // radians
    cy: number;      // 0..1 of the viewport height
    duration: number; // seconds this pose is targeted
}

interface ChartScene {
    laneCount: number;
    approach: number;
    baseInterval: number;
    holdChance: number;
    fxStyle: number;
    paletteVariant: number;
    hueShift: number;
    noteShape: number;
    segments: SegmentPose[];
    loopDuration: number;
    segmentStarts: number[];
}

interface PhigrosBackgroundProps {
    theme: Theme;
    isDaylight: boolean;
    audioPower: MotionValue<number>;
    seed?: string | number;
    staticMode: boolean;
    paused: boolean;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

const hsla = (h: number, s: number, l: number, a = 1) => {
    const hh = ((Math.round(h) % 360) + 360) % 360;
    return `hsla(${hh},${Math.round(s)}%,${Math.round(l)}%,${a})`;
};

const hashString = (input: string): number => {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const mulberry32 = (seed: number) => {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const hexToHue = (hex: string | undefined, fallback = 210): number => {
    if (!hex) return fallback;
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return fallback;
    const value = parseInt(match[1], 16);
    const r = ((value >> 16) & 255) / 255;
    const g = ((value >> 8) & 255) / 255;
    const b = (value & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    let h: number;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return h * 60;
};

const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) => {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
};

const buildScene = (seed: string | number | undefined): ChartScene => {
    const rng = mulberry32(hashString(String(seed ?? 'phigros')));
    const laneCount = 4 + Math.floor(rng() * 3); // 4..6
    const approach = 0.9 + rng() * 0.55;
    const baseInterval = 0.24 + rng() * 0.3;
    const segments: SegmentPose[] = [];
    const segmentStarts: number[] = [];
    let cursor = 0;
    const count = 24;
    for (let i = 0; i < count; i += 1) {
        segmentStarts.push(cursor);
        const duration = 2 + rng() * 2.5;
        segments.push({
            angle: (rng() * 2 - 1) * (Math.PI / 180) * 26,
            cy: 0.52 + rng() * 0.32,
            duration,
        });
        cursor += duration;
    }

    return {
        laneCount,
        approach,
        baseInterval,
        holdChance: 0.16 + rng() * 0.14,
        fxStyle: Math.floor(rng() * 3),
        paletteVariant: Math.floor(rng() * 3),
        hueShift: Math.floor(rng() * 360),
        noteShape: Math.floor(rng() * 2),
        segments,
        loopDuration: cursor,
        segmentStarts,
    };
};

const VisualizerPhigrosBackground: React.FC<PhigrosBackgroundProps> = ({
    theme,
    isDaylight,
    audioPower,
    seed,
    staticMode,
    paused,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const themeRef = useRef(theme);
    themeRef.current = theme;
    const daylightRef = useRef(isDaylight);
    daylightRef.current = isDaylight;
    const pausedRef = useRef(paused);
    pausedRef.current = paused;
    const staticRef = useRef(staticMode);
    staticRef.current = staticMode;
    const audioPowerRef = useRef(audioPower);
    audioPowerRef.current = audioPower;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        const scene = buildScene(seed);
        const rng = mulberry32(hashString(String(seed ?? 'phigros')) ^ 0x9e3779b9);

        let width = 1;
        let height = 1;
        let dpr = 1;
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);

        const notes: BackgroundNote[] = [];
        let nextSpawn = 0.1;
        let lastLane = -1;
        const spawnNote = (spawn: number, power: number) => {
            const interval = scene.baseInterval * (1 - power * 0.25);
            let lane = Math.floor(rng() * scene.laneCount);
            if (lane === lastLane && rng() < 0.7) lane = (lane + 1 + Math.floor(rng() * (scene.laneCount - 1))) % scene.laneCount;
            lastLane = lane;
            const kind = rng() < scene.holdChance ? 'hold' : 'tap';
            notes.push({
                lane,
                kind,
                spawn,
                approach: scene.approach,
                hold: kind === 'hold' ? 0.35 + rng() * 0.75 : 0,
                color: Math.floor(rng() * 6),
            });
            return spawn + interval;
        };

        // A static frame (ThemePark preview, static export) shows a mid-fall
        // snapshot instead of an empty first frame.
        let clock = staticRef.current ? scene.approach * 0.6 : 0;
        let angle = scene.segments[0]?.angle ?? 0;
        let cyFrac = scene.segments[0]?.cy ?? 0.7;
        let last = performance.now();
        let raf = 0;

        const segmentAt = (t: number): SegmentPose => {
            const looped = ((t % scene.loopDuration) + scene.loopDuration) % scene.loopDuration;
            let lo = 0;
            let hi = scene.segmentStarts.length - 1;
            while (lo < hi) {
                const mid = (lo + hi + 1) >> 1;
                if (scene.segmentStarts[mid] <= looped) lo = mid;
                else hi = mid - 1;
            }
            return scene.segments[lo];
        };

        const drawTap = (note: BackgroundNote, x: number, y: number, w: number, h: number, radius: number, alpha: number, fills: string[], edge: string) => {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = fills[note.color % fills.length];
            ctx.strokeStyle = edge;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = fills[note.color % fills.length];
            ctx.shadowBlur = 12;
            drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, radius);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.stroke();
            ctx.restore();
        };

        const drawHold = (note: BackgroundNote, x: number, headY: number, tailY: number, w: number, h: number, radius: number, alpha: number, fills: string[], edge: string) => {
            const top = Math.min(headY, tailY);
            const bottom = Math.max(headY, tailY);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = fills[note.color % fills.length];
            ctx.strokeStyle = edge;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = fills[note.color % fills.length];
            ctx.shadowBlur = 10;
            drawRoundedRect(ctx, x - w / 2, top - h / 2, w, (bottom - top) + h, radius);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.stroke();
            ctx.restore();
        };

        const drawHitFx = (x: number, age: number, speed: number, style: number, color: string) => {
            const a = Math.max(0, 1 - age / 0.4);
            const r = 6 + age * speed * 1.05;
            ctx.save();
            ctx.globalAlpha = a;
            if (style === 0 || style === 2) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(x, 0, r, 0, TAU);
                ctx.stroke();
            }
            if (style === 1 || style === 2) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                const shards = 6;
                for (let k = 0; k < shards; k += 1) {
                    const ang = (k / shards) * TAU + (x % 2) * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(x + Math.cos(ang) * r * 0.3, Math.sin(ang) * r * 0.3);
                    ctx.lineTo(x + Math.cos(ang) * r * 0.95, Math.sin(ang) * r * 0.95);
                    ctx.stroke();
                }
            }
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, 0, Math.max(1.5, 3 - age * 6), 0, TAU);
            ctx.fill();
            ctx.restore();
        };

        const draw = (t: number, dt: number) => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            const day = daylightRef.current;
            const currentTheme = themeRef.current;
            const power = clamp(audioPowerRef.current.get(), 0, 1);

            const hue = (((hexToHue(currentTheme.primaryColor) + scene.hueShift) % 360) + 360) % 360;
            const sat = scene.paletteVariant === 2 ? 58 : 82;
            const lightBase = day ? 44 : (scene.paletteVariant === 2 ? 70 : 60);
            const fills = scene.paletteVariant === 1
                ? [
                    hsla(hue, sat, lightBase),
                    hsla(hue + 150, sat, lightBase),
                    hsla(hue, sat, lightBase),
                    hsla(hue + 150, sat, lightBase),
                    hsla(hue, sat, lightBase),
                    hsla(hue + 150, sat, lightBase),
                ]
                : [
                    hsla(hue, sat, lightBase),
                    hsla(hue + 38, sat, lightBase),
                    hsla(hue - 42, sat, lightBase),
                    hsla(hue + 140, sat, lightBase),
                    hsla(hue + 200, sat, lightBase),
                    hsla(hue + 320, sat, lightBase),
                ];
            const lineColor = hsla(hue, 88, day ? 46 : 62);
            const edge = hsla(hue, 90, day ? 30 : 78, 0.9);
            const ripple = currentTheme.accentColor || hsla(hue + 150, 90, 64);

            const target = segmentAt(t);
            angle += (target.angle - angle) * Math.min(1, dt * 3);
            cyFrac += (target.cy - cyFrac) * Math.min(1, dt * 3);

            const cx = width / 2;
            const cy = height * cyFrac;
            const lineHalf = Math.min(width * 0.46, height * 0.62);
            const laneSpacing = (lineHalf * 2) / scene.laneCount;
            const noteW = laneSpacing * 0.8;
            const noteH = clamp(noteW * 0.46, 24, 52);
            const radius = scene.noteShape === 0 ? noteH * 0.4 : noteH * 0.16;
            const speed = (height * 1.15) / scene.approach;

            // Keep enough notes in flight; prune ones that are done.
            while (nextSpawn <= t + scene.approach + 0.4) {
                nextSpawn = spawnNote(nextSpawn, power);
            }
            while (notes.length > 0 && notes[0].spawn + notes[0].approach + notes[0].hold < t - 0.5) {
                notes.shift();
            }

            let recentGlow = 0;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);

            for (const note of notes) {
                if (note.spawn > t) break;
                const laneX = (note.lane - (scene.laneCount - 1) / 2) * laneSpacing;
                const p = (t - note.spawn) / note.approach;

                if (note.kind === 'tap') {
                    if (p <= 1) {
                        const y = -height * 1.15 * (1 - p);
                        drawTap(note, laneX, y, noteW, noteH, radius, 1, fills, edge);
                    }
                    if (p >= 1 && p < 1.16) {
                        drawHitFx(laneX, p - 1, speed, scene.fxStyle, ripple);
                        recentGlow += 1 - (p - 1) / 0.16;
                    }
                } else {
                    const holdLen = Math.max(noteH * 1.2, note.hold * speed);
                    let headY: number;
                    let tailY: number;
                    let alpha = 1;
                    const total = note.spawn + note.approach + note.hold;
                    if (t < note.spawn + note.approach) {
                        headY = -height * 1.15 * (1 - p);
                        tailY = headY - holdLen;
                    } else if (t <= total) {
                        headY = 0;
                        tailY = -(total - t) * speed;
                    } else {
                        headY = 0;
                        tailY = 0;
                        alpha = Math.max(0, 1 - (t - total) / 0.16);
                    }
                    drawHold(note, laneX, headY, tailY, noteW, noteH, radius, alpha, fills, edge);
                    if (t >= note.spawn + note.approach && t < note.spawn + note.approach + 0.16) {
                        const age = t - (note.spawn + note.approach);
                        drawHitFx(laneX, age, speed, scene.fxStyle, ripple);
                        recentGlow += 1 - age / 0.16;
                    }
                }
            }

            const glow = 8 + power * 20 + recentGlow * 16;
            ctx.save();
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.shadowColor = lineColor;
            ctx.shadowBlur = glow;
            ctx.beginPath();
            ctx.moveTo(-lineHalf - noteW * 0.4, 0);
            ctx.lineTo(lineHalf + noteW * 0.4, 0);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = lineColor;
            ctx.save();
            ctx.rotate(Math.PI / 4);
            const marker = noteH * 0.28;
            ctx.fillRect(-marker, -marker, marker * 2, marker * 2);
            ctx.restore();
            ctx.restore();

            ctx.restore();
        };

        const loop = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (!pausedRef.current && !staticRef.current) {
                clock += dt;
            }
            draw(clock, pausedRef.current ? 0 : dt);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
        };
    }, [seed]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
        />
    );
};

export default VisualizerPhigrosBackground;
