import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValueEvent } from 'framer-motion';
import type { Line } from '../../../types';
import type { VisualizerSharedProps } from '../definition';
import VisualizerShell from '../VisualizerShell';
import { resolveThemeFontStack, resolveThemeFontWeight, resolveThemeTranslationFontStack } from '../../../utils/fontStacks';

// src/components/visualizer/phigroslyrics/VisualizerPhigrosLyrics.tsx
// Karaoke lyric style that pairs with the Phigros chart background. The current
// line fills in word by word (each word "hit" as the clock passes it), with the
// previous and next lines dimmed around it and the translation below. The whole
// layer is transparent so the chart background stays visible behind the lyrics.

interface LyricUnit {
    text: string;
    start: number;
    end: number;
}

const buildLineUnits = (line: Line): LyricUnit[] => {
    if (line.words.length > 0) {
        return line.words.map(word => ({ text: word.text, start: word.startTime, end: word.endTime }));
    }
    const chars = Array.from(line.fullText);
    if (chars.length === 0) return [];
    const duration = Math.max(0.05, line.endTime - line.startTime);
    return chars.map((char, index) => ({
        text: char,
        start: line.startTime + (duration * index) / chars.length,
        end: line.startTime + (duration * (index + 1)) / chars.length,
    }));
};

const VisualizerPhigrosLyrics: React.FC<VisualizerSharedProps> = ({
    currentTime,
    currentLineIndex,
    lines,
    theme,
    subtitleTheme,
    audioPower,
    audioBands,
    isDaylight = false,
    lyricsFontScale = 1,
    subtitleFontScale = 1,
    hideTranslationSubtitle = false,
    showText = true,
    ...sharedProps
}) => {
    const [effectiveIndex, setEffectiveIndex] = useState(() => Math.max(0, currentLineIndex));
    const [activeUnitIndex, setActiveUnitIndex] = useState(-1);

    const effectiveIndexRef = useRef(effectiveIndex);
    effectiveIndexRef.current = effectiveIndex;
    const linesRef = useRef(lines);
    linesRef.current = lines;

    useEffect(() => {
        if (currentLineIndex !== -1) {
            setEffectiveIndex(currentLineIndex);
        } else if (effectiveIndex >= lines.length) {
            setEffectiveIndex(0);
        }
    }, [currentLineIndex, effectiveIndex, lines.length]);

    useEffect(() => {
        setActiveUnitIndex(-1);
    }, [effectiveIndex, lines]);

    useMotionValueEvent(currentTime, 'change', (t) => {
        const index = effectiveIndexRef.current;
        const list = linesRef.current;
        const line = index >= 0 && index < list.length ? list[index] : undefined;
        if (!line) return;
        const units = buildLineUnits(line);
        let next = -1;
        for (let i = 0; i < units.length; i += 1) {
            if (t >= units[i].start && t < units[i].end) {
                next = i;
                break;
            }
            if (units[i].start > t) break;
        }
        setActiveUnitIndex(prev => (prev === next ? prev : next));
    });

    const units = useMemo(() => {
        const index = effectiveIndex;
        const current = index >= 0 && index < lines.length ? lines[index] : undefined;
        return current ? buildLineUnits(current) : [];
    }, [lines, effectiveIndex]);

    const resolvedSubtitleTheme = subtitleTheme ?? theme;
    const fontStack = resolveThemeFontStack(theme);
    const translationFontStack = resolveThemeTranslationFontStack(resolvedSubtitleTheme);
    const currentWeight = resolveThemeFontWeight(theme, 700);
    const sideWeight = resolveThemeFontWeight(theme, 600);
    const translationWeight = resolveThemeFontWeight(resolvedSubtitleTheme, 500);

    return (
        <VisualizerShell
            theme={theme}
            audioPower={audioPower}
            audioBands={audioBands}
            sharedProps={{
                ...sharedProps,
                isDaylight,
            }}
            renderBackground={false}
            className="visualizer-phigroslyrics"
        >
            {showText && (
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none px-10 pb-16 gap-7">
                    {[-1, 0, 1].map((offset) => {
                        const lineIndex = effectiveIndex + offset;
                        const neighbour = lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : undefined;
                        if (!neighbour) {
                            return <div key={`empty-${offset}`} className="h-16" />;
                        }

                        const isCurrent = offset === 0;
                        return (
                            <div key={lineIndex} className="flex flex-col items-center w-full max-w-4xl">
                                {isCurrent ? (
                                    <div
                                        className="flex flex-wrap justify-center text-center"
                                        style={{
                                            color: theme.primaryColor,
                                            fontFamily: fontStack,
                                            fontWeight: currentWeight,
                                            fontSize: `${2.4 * lyricsFontScale}rem`,
                                            lineHeight: 1.35,
                                        }}
                                    >
                                        {units.map((unit, index) => {
                                            const waiting = index > activeUnitIndex;
                                            const active = index === activeUnitIndex;
                                            return (
                                                <span
                                                    key={`${unit.start}-${index}`}
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '0 0.08em 0.12em',
                                                        color: waiting ? theme.secondaryColor : theme.primaryColor,
                                                        opacity: waiting ? 0.38 : 1,
                                                        textShadow: active ? `0 0 18px ${theme.primaryColor}` : undefined,
                                                        borderBottom: active ? `2px solid ${theme.primaryColor}` : '2px solid transparent',
                                                    }}
                                                >
                                                    {unit.text}
                                                </span>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div
                                        className="text-center w-full"
                                        style={{
                                            color: theme.secondaryColor,
                                            fontFamily: fontStack,
                                            fontWeight: sideWeight,
                                            fontSize: `${1.4 * lyricsFontScale}rem`,
                                            lineHeight: 1.35,
                                            opacity: 0.3,
                                        }}
                                    >
                                        {neighbour.fullText}
                                    </div>
                                )}
                                {isCurrent && neighbour.translation && !hideTranslationSubtitle && (
                                    <div
                                        className="text-center mt-3"
                                        style={{
                                            color: resolvedSubtitleTheme.secondaryColor,
                                            fontFamily: translationFontStack,
                                            fontWeight: translationWeight,
                                            fontSize: `${1.05 * lyricsFontScale * subtitleFontScale}rem`,
                                            opacity: 0.8,
                                        }}
                                    >
                                        {neighbour.translation}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </VisualizerShell>
    );
};

export default VisualizerPhigrosLyrics;
