import { View, useWindowDimensions } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia'
import { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'

const COLS = 8
const ROWS = 8
const GAP = 16

export const PlayScreen = () => {
    const piece = {
        id: 'piece-1',

        cells: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: 2 },
            { x: 1, y: 2 },
        ],
    }
    const position = useSharedValue({ x: 0, y: 0 });
    // translate mean how far it move form it original position in x and y direction
    const translate = useSharedValue({ x: 0, y: 0 })
    const { width } = useWindowDimensions()

    const boardSize = width * 0.9
    const cellSize = (boardSize - GAP * (COLS - 1)) / COLS
    // piece which will be dragable 
    const PIECE_CELL_SIZE = cellSize * 0.8
    const pieceX = boardSize * 0.25
    const pieceY = boardSize + 50

    // calculating the neareset board cell
    const STEP = cellSize + GAP
    // this function ask is every cell in my piece  inside board or not
    const canPlacePiece = (gridX: number, gridY: number) => {
        'worklet'
        return piece.cells.every((cell) => {
            const x = gridX + cell.x
            const y = gridY + cell.y

            return (
                x >= 0 &&
                x < COLS &&
                y >= 0 &&
                y < ROWS
            )
        })
    }
    // logic of moving gesture 
    const panGesture = usePanGesture({
        onUpdate: (e) => {
            translate.value = {
                x: e.translationX,
                y: e.translationY,
            };
        },

        onDeactivate: () => {
            const currentX = pieceX + position.value.x + translate.value.x;
            const currentY = pieceY + position.value.y + translate.value.y;

            const gridX = Math.round(currentX / STEP);
            const gridY = Math.round(currentY / STEP);

            const isValid = canPlacePiece(gridX, gridY);

            if (isValid) {

                const snappedX = gridX * STEP;
                const snappedY = gridY * STEP;

                position.value = {
                    x: snappedX - pieceX,
                    y: snappedY - pieceY,
                }
            } else {
                position.value = {
                    x: position.value.x,
                    y: position.value.y
                }
            }


            translate.value = {
                x: 0,
                y: 0,
            };
        },
    });
    const pieceTransform = useDerivedValue(() => {
        return [
            { translateX: position.value.x + translate.value.x },
            { translateY: position.value.y + translate.value.y },
        ]
    })
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f7e5d0" }}>
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <GestureDetector gesture={panGesture}>
                    <Canvas
                        style={{
                            width: boardSize,
                            height: boardSize + 300,
                        }}
                    >
                        <Group color="#f0cca3">
                            {Array.from({ length: ROWS }, (_, row) =>
                                Array.from({ length: COLS }, (_, col) => (
                                    <RoundedRect
                                        key={`${row}-${col}`}
                                        x={col * (cellSize + GAP)}
                                        y={row * (cellSize + GAP)}
                                        width={cellSize}
                                        height={cellSize}
                                        r={6}
                                    />
                                ))
                            )}
                        </Group>
                        <Group
                            transform={pieceTransform}
                        >
                            {piece.cells.map((cell, index) => (
                                <RoundedRect
                                    key={index}
                                    x={pieceX + cell.x * (PIECE_CELL_SIZE + GAP)}
                                    y={pieceY + cell.y * (PIECE_CELL_SIZE + GAP)}
                                    width={PIECE_CELL_SIZE}
                                    height={PIECE_CELL_SIZE}
                                    r={8}
                                    color="#8ecf73"
                                />
                            ))}
                        </Group>
                    </Canvas>
                </GestureDetector>
            </View>
        </SafeAreaView>
    )
}
