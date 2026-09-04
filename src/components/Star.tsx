import React from 'react';
import { Group, Path, LinearGradient, vec, Skia, CornerPathEffect } from '@shopify/react-native-skia';

interface StarProps {
    x: number;
    y: number;
    scale?: number;
    isEmpty?: boolean;
}

export const Star = ({ x, y, scale = 1, isEmpty = false }: StarProps) => {
    // 24x24 star path
    const starPathStr = "M12 1L15.39 8.26L23 9.27L17.5 14.14L18.79 21.73L12 17.8L5.21 21.73L6.5 14.14L1 9.27L8.61 8.26L12 1Z";
    const starPath = Skia.Path.MakeFromSVGString(starPathStr) || Skia.Path.Make();
    
    // Scale down the highlight slightly
    const highlightPath = Skia.Path.MakeFromSVGString(starPathStr) || Skia.Path.Make();
    const highlightMatrix = Skia.Matrix();
    highlightMatrix.translate(12, 12);
    highlightMatrix.scale(0.6, 0.6);
    highlightMatrix.translate(-12, -12);
    highlightPath.transform(highlightMatrix);

    const cornerRadius = 1.5;

    return (
        <Group transform={[{ translateX: x }, { translateY: y }, { scale }]}>
            {/* Center everything around 0,0 by translating -12, -12 (since SVG is 24x24) */}
            
            {/* Drop Shadow */}
            <Group transform={[{ translateX: -12 }, { translateY: -8 }]}>
                <Path path={starPath} color="rgba(0,0,0,0.2)">
                    <CornerPathEffect r={cornerRadius} />
                </Path>
            </Group>

            {/* Base 3D Extrusion */}
            <Group transform={[{ translateX: -12 }, { translateY: -10 }]}>
                <Path path={starPath} color={isEmpty ? "#424242" : "#d35400"}>
                    <CornerPathEffect r={cornerRadius} />
                </Path>
            </Group>

            {/* Top Surface */}
            <Group transform={[{ translateX: -12 }, { translateY: -12 }]}>
                <Path path={starPath}>
                    <CornerPathEffect r={cornerRadius} />
                    <LinearGradient
                        start={vec(0, 0)}
                        end={vec(24, 24)}
                        colors={isEmpty ? ['#757575', '#616161'] : ['#fff200', '#f39c12']}
                    />
                </Path>
            </Group>

            {/* Glossy Highlight */}
            {!isEmpty && (
                <Group transform={[{ translateX: -12 }, { translateY: -13 }]}>
                    <Path path={highlightPath} color="rgba(255,255,255,0.4)">
                        <CornerPathEffect r={cornerRadius * 0.6} />
                    </Path>
                </Group>
            )}
        </Group>
    );
};
