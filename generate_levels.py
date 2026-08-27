import json
import random

def slice_grid(w, h, num_pieces, board_cols, board_rows):
    grid = [[-1 for _ in range(w)] for _ in range(h)]
    seeds = []
    while len(seeds) < num_pieces:
        r, c = random.randint(0, h-1), random.randint(0, w-1)
        if (r, c) not in seeds:
            seeds.append((r, c))
            grid[r][c] = len(seeds) - 1
            
    unassigned = [(r, c) for r in range(h) for c in range(w) if grid[r][c] == -1]
    random.shuffle(unassigned)
    
    while unassigned:
        progress = False
        for r, c in list(unassigned):
            neighbors = []
            if r > 0 and grid[r-1][c] != -1: neighbors.append(grid[r-1][c])
            if r < h-1 and grid[r+1][c] != -1: neighbors.append(grid[r+1][c])
            if c > 0 and grid[r][c-1] != -1: neighbors.append(grid[r][c-1])
            if c < w-1 and grid[r][c+1] != -1: neighbors.append(grid[r][c+1])
            
            if neighbors:
                grid[r][c] = random.choice(neighbors)
                unassigned.remove((r, c))
                progress = True
        
        if not progress:
            r, c = unassigned[0]
            grid[r][c] = random.choice(range(num_pieces))
            unassigned.remove((r, c))
            
    pieces = []
    colors = ['#8ecf73', '#73a9cf', '#cf8e73', '#b573cf', '#cf7399', '#cfc873', '#73cfb7', '#7773cf', '#a2cf73', '#cf9f73']
    
    spawn_grid = [[-1] * board_cols for _ in range(board_rows)]
    
    for i in range(num_pieces):
        cells = []
        for r in range(h):
            for c in range(w):
                if grid[r][c] == i:
                    cells.append({"x": c, "y": r})
                    
        min_x = min(c["x"] for c in cells)
        min_y = min(c["y"] for c in cells)
        norm_cells = [{"x": c["x"] - min_x, "y": c["y"] - min_y} for c in cells]
        target = {"x": min_x, "y": min_y}
        
        pw = max(c["x"] for c in norm_cells) + 1
        ph = max(c["y"] for c in norm_cells) + 1
        
        spawn_x, spawn_y = 0, 0
        found = False
        for sr in range(board_rows - ph + 1):
            for sc in range(board_cols - pw + 1):
                fit = True
                for c in norm_cells:
                    if spawn_grid[sr + c["y"]][sc + c["x"]] != -1:
                        fit = False
                        break
                if fit:
                    for c in norm_cells:
                        spawn_grid[sr + c["y"]][sc + c["x"]] = i
                    spawn_x, spawn_y = sc, sr
                    found = True
                    break
            if found: break
            
        if not found:
            spawn_x, spawn_y = random.randint(0, board_cols - pw), random.randint(0, board_rows - ph)
            
        pieces.append({
            "id": f"piece-{i}",
            "cells": norm_cells,
            "target": target,
            "spawn": {"x": spawn_x, "y": spawn_y},
            "color": colors[i % len(colors)]
        })
        
    return pieces

random.seed(42)

levels = []
configs = [
    (3, 3, 4),  # L1
    (3, 3, 5),  # L2
    (4, 4, 6),  # L3
    (4, 4, 7),  # L4
    (4, 4, 8),  # L5
    (5, 5, 9),  # L6
    (5, 5, 10), # L7
    (5, 5, 11), # L8
    (5, 5, 12), # L9
    (6, 6, 14), # L10
]

import math

for idx, (w, h, pieces) in enumerate(configs):
    board_cols = math.ceil(w * 1.5)
    board_rows = math.ceil(h * 1.5)
    img_num = (idx % 7) + 1
    levels.append({
        "level_id": idx + 1,
        "board_size": {"cols": board_cols, "rows": board_rows},
        "puzzle_size": {"cols": w, "rows": h},
        "image": f"img{img_num}",
        "pieces": slice_grid(w, h, pieces, board_cols, board_rows)
    })

with open("src/assets/levels.json", "w") as f:
    json.dump(levels, f, indent=4)

print("Levels generated successfully!")
