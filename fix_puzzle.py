import re

with open('src/components/PuzzleBoard.tsx', 'r') as f:
    content = f.read()

# Replace usePieceState hook definition
content = content.replace(
    'function usePieceState(\n    initialX: number,\n    initialY: number,\n    isPuzzleCompleted: SharedValue<boolean>,\n    index: number\n) {',
    'function usePieceState(\n    initialX: number,\n    initialY: number,\n    isPuzzleCompleted: SharedValue<boolean>,\n    index: number,\n    isActive: boolean\n) {'
)

# Replace playWhoosh inside usePieceState
content = content.replace(
    'entranceY.value = withSpring(0, { damping: 14, stiffness: 80, mass: 1 })\n            playWhoosh()',
    'entranceY.value = withSpring(0, { damping: 14, stiffness: 80, mass: 1 })\n            if (isActive) playWhoosh()'
)

# Replace 40 lines of allStates
def repl(m):
    idx = m.group(1)
    return f'usePieceState(getInitialX({idx}), getInitialY({idx}), isPuzzleCompleted, {idx}, {idx} < PIECES.length)'

content = re.sub(r'usePieceState\(getInitialX\((\d+)\), getInitialY\(\d+\), isPuzzleCompleted, \d+\)', repl, content)

# Also fix Object is possibly undefined in play functions
content = content.replace('whooshSound.stop', 'whooshSound?.stop').replace('whooshSound.play', 'whooshSound?.play')
content = content.replace('popSound.stop', 'popSound?.stop').replace('popSound.play', 'popSound?.play')
content = content.replace('correctSound.stop', 'correctSound?.stop').replace('correctSound.play', 'correctSound?.play')

with open('src/components/PuzzleBoard.tsx', 'w') as f:
    f.write(content)
