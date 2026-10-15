import { groupRestingPieces, PieceDef } from '../src/components/PuzzleBoard';

const piece = (id: string, target: { x: number; y: number }, cells = [{ x: 0, y: 0 }]): PieceDef => ({
  id,
  cells,
  target,
  spawn: { x: 0, y: 0 },
  color: '#000',
});

// Solution layout (2×2): A B / C D
const A = piece('A', { x: 0, y: 0 });
const B = piece('B', { x: 1, y: 0 });
const C = piece('C', { x: 0, y: 1 });
const D = piece('D', { x: 1, y: 1 });
const PIECES = [A, B, C, D];

const sorted = (groups: number[][]) => groups.map((g) => [...g].sort()).sort((a, b) => a[0] - b[0]);

describe('groupRestingPieces', () => {
  test('correctly joined neighbours merge, even away from the origin', () => {
    const grid = [
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ];
    expect(sorted(groupRestingPieces(PIECES, grid, [0, 1, 2, 3]))).toEqual([[0, 1, 2, 3]]);
  });

  test('pieces that only touch in the wrong arrangement stay separate', () => {
    // B placed left of A instead of right of it.
    const grid = [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 7, y: 7 },
    ];
    expect(sorted(groupRestingPieces(PIECES, grid, [0, 1, 2, 3]))).toEqual([[0], [1], [2], [3]]);
  });

  test('three correct pieces around an empty cell merge without the missing one', () => {
    const grid = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 6, y: 6 },
    ];
    expect(sorted(groupRestingPieces(PIECES, grid, [0, 1, 2, 3]))).toEqual([[0, 1, 2], [3]]);
  });

  test('diagonal-only contact does not merge', () => {
    const grid = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 6, y: 6 },
      { x: 1, y: 1 },
    ];
    expect(sorted(groupRestingPieces(PIECES, grid, [0, 3]))).toEqual([[0], [3]]);
  });

  test('pieces not resting (dragged / still falling) are left out', () => {
    const grid = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(sorted(groupRestingPieces(PIECES, grid, [0, 2]))).toEqual([[0, 2]]);
  });
});
