import React from 'react';
import { Group, Path, LinearGradient, vec, Skia, CornerPathEffect } from '@shopify/react-native-skia';

interface StarProps {
    x: number;
    y: number;
    scale?: number;
    isEmpty?: boolean;
}

// 24x24 star path - parsed once at module load
const STAR_PATH_STR = 'M12 1L15.39 8.26L23 9.27L17.5 14.14L18.79 21.73L12 17.8L5.21 21.73L6.5 14.14L1 9.27L8.61 8.26L12 1Z';
const STAR_PATH = Skia.Path.MakeFromSVGString(STAR_PATH_STR) || Skia.Path.Make();

// Scaled-down highlight path - transformed once at module load
const HIGHLIGHT_PATH = (() => {
    const path = Skia.Path.MakeFromSVGString(STAR_PATH_STR) || Skia.Path.Make();
    const highlightMatrix = Skia.Matrix();
    highlightMatrix.translate(12, 12);
    highlightMatrix.scale(0.6, 0.6);
    highlightMatrix.translate(-12, -12);
    path.transform(highlightMatrix);
    return path;
})();

const CORNER_RADIUS = 1.5;
const HIGHLIGHT_CORNER_RADIUS = CORNER_RADIUS * 0.6;
const GRADIENT_START = vec(0, 0);
const GRADIENT_END = vec(24, 24);
const EMPTY_COLORS = ['#757575', '#616161'];
const ACTIVE_COLORS = ['#fff200', '#f39c12'];

export const Star = React.memo(({ x, y, scale = 1, isEmpty = false }: StarProps) => {
    return (
        <Group transform={[{ translateX: x }, { translateY: y }, { scale }]}>
            {/* Center everything around 0,0 by translating -12, -12 (since SVG is 24x24) */}

            {/* Drop Shadow */}
            <Group transform={[{ translateX: -12 }, { translateY: -8 }]}>
                <Path path={STAR_PATH} color="rgba(0,0,0,0.2)">
                    <CornerPathEffect r={CORNER_RADIUS} />
                </Path>
            </Group>

            {/* Base 3D Extrusion */}
            <Group transform={[{ translateX: -12 }, { translateY: -10 }]}>
                <Path path={STAR_PATH} color={isEmpty ? '#424242' : '#d35400'}>
                    <CornerPathEffect r={CORNER_RADIUS} />
                </Path>
            </Group>

            {/* Top Surface */}
            <Group transform={[{ translateX: -12 }, { translateY: -12 }]}>
                <Path path={STAR_PATH}>
                    <CornerPathEffect r={CORNER_RADIUS} />
                    <LinearGradient
                        start={GRADIENT_START}
                        end={GRADIENT_END}
                        colors={isEmpty ? EMPTY_COLORS : ACTIVE_COLORS}
                    />
                </Path>
            </Group>

            {/* Glossy Highlight */}
            {!isEmpty && (
                <Group transform={[{ translateX: -12 }, { translateY: -13 }]}>
                    <Path path={HIGHLIGHT_PATH} color="rgba(255,255,255,0.4)">
                        <CornerPathEffect r={HIGHLIGHT_CORNER_RADIUS} />
                    </Path>
                </Group>
            )}
        </Group>
    );
});
