import React from 'react';
import { defineVisualizerBackground } from '../definition';

const VisualizerPhigrosBackground = React.lazy(() => import('./VisualizerPhigrosBackground'));

// src/components/visualizer/backgrounds/phigros/entry.tsx
// Registers the Phigros-style falling-note chart background.
export default defineVisualizerBackground({
    mode: 'phigros',
    order: 40,
    labelKey: 'options.visualizerBackgroundModePhigros',
    labelFallback: 'Phigros',
    // 谱面：下落音符与倾斜判定线
    glyph: (
        <>
            <path d="M4 18.5h16" />
            <path d="M7 4v6" opacity="0.9" />
            <path d="M13 7.5v6" opacity="0.65" />
            <path d="M18 6v4" opacity="0.5" />
        </>
    ),
    command: {
        title: 'Background: Phigros',
        description: 'Switch background to the Phigros-style falling-note chart',
        keywords: ['phigros', 'chart', 'falling notes', 'judgement line', '谱面', '下落', '判定线', '音符'],
    },
    // A new song gets a fresh chart: the whole pattern is seeded per song.
    song: ({ seed }) => [seed ?? null],
    render: ({ theme, isDaylight, audioPower, seed, staticMode, paused }) => (
        <VisualizerPhigrosBackground
            theme={theme}
            isDaylight={isDaylight}
            audioPower={audioPower}
            seed={seed}
            staticMode={staticMode}
            paused={paused}
        />
    ),
});
