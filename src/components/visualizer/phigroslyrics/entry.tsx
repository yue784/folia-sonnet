import React from 'react';
import { defineVisualizer } from '../definition';

const VisualizerPhigrosLyrics = React.lazy(() => import('./VisualizerPhigrosLyrics'));

// src/components/visualizer/phigroslyrics/entry.tsx
// Registers the karaoke lyric style that pairs with the Phigros chart background.
export default defineVisualizer({
    mode: 'phigroslyrics',
    order: 66,
    labelKey: 'ui.visualizerPhigrosLyrics',
    labelFallback: 'Phigros Lyrics',
    previewSeed: 'phigroslyrics',
    previewStartOffset: 0,
    // 谱面歌词：三行歌词，当前行逐字点亮
    glyph: (
        <>
            <path d="M5 7.5h14" opacity="0.35" />
            <path d="M3 12h18" />
            <path d="M6 16.5h12" opacity="0.35" />
            <path d="M8 12h2" strokeWidth="2.4" />
        </>
    ),
    command: {
        title: 'Visualizer: Phigros Lyrics',
        description: 'Switch to the karaoke lyric style that pairs with the Phigros chart background',
        keywords: ['phigros lyrics', 'chart lyrics', 'karaoke', '谱面歌词', '歌词样式', '逐字', '卡拉OK'],
    },
    render: props => <VisualizerPhigrosLyrics {...props} />,
});
