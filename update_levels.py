import json

with open("src/assets/levels.json", "r") as f:
    levels = json.load(f)

for level in levels:
    if level["level_id"] == 10:
        level["pieces"] = [
            {
                "id": "piece-0",
                "cells": [{"x": 0, "y": 0}, {"x": 1, "y": 0}, {"x": 1, "y": 1}, {"x": 2, "y": 1}],
                "target": {"x": 0, "y": 0},
                "spawn": {"x": 0, "y": 0},
                "color": "#cf7399"
            },
            {
                "id": "piece-1",
                "cells": [{"x": 0, "y": 0}, {"x": 1, "y": 0}, {"x": 2, "y": 0}, {"x": 2, "y": 1}],
                "target": {"x": 2, "y": 0},
                "spawn": {"x": 4, "y": 0},
                "color": "#cf8e73"
            },
            {
                "id": "piece-2",
                "cells": [{"x": 0, "y": 0}, {"x": 0, "y": 1}, {"x": 0, "y": 2}, {"x": 0, "y": 3}],
                "target": {"x": 5, "y": 0},
                "spawn": {"x": 7, "y": 0},
                "color": "#cfc873"
            },
            {
                "id": "piece-3",
                "cells": [{"x": 0, "y": 0}, {"x": 0, "y": 1}, {"x": 0, "y": 2}, {"x": 1, "y": 1}],
                "target": {"x": 0, "y": 1},
                "spawn": {"x": 0, "y": 3},
                "color": "#8ecf73"
            },
            {
                "id": "piece-4",
                "cells": [{"x": 0, "y": 1}, {"x": 1, "y": 0}, {"x": 1, "y": 1}, {"x": 2, "y": 1}],
                "target": {"x": 2, "y": 1},
                "spawn": {"x": 7, "y": 3},
                "color": "#73cfb7"
            },
            {
                "id": "piece-5",
                "cells": [{"x": 0, "y": 0}, {"x": 1, "y": 0}, {"x": 1, "y": 1}, {"x": 2, "y": 0}],
                "target": {"x": 1, "y": 3},
                "spawn": {"x": 0, "y": 6},
                "color": "#73a9cf"
            },
            {
                "id": "piece-6",
                "cells": [{"x": 0, "y": 0}, {"x": 0, "y": 1}, {"x": 1, "y": 0}, {"x": 1, "y": 1}],
                "target": {"x": 0, "y": 4},
                "spawn": {"x": 4, "y": 6},
                "color": "#7773cf"
            },
            {
                "id": "piece-7",
                "cells": [{"x": 0, "y": 1}, {"x": 1, "y": 0}, {"x": 1, "y": 1}, {"x": 2, "y": 1}],
                "target": {"x": 2, "y": 4},
                "spawn": {"x": 6, "y": 6},
                "color": "#b573cf"
            },
            {
                "id": "piece-8",
                "cells": [{"x": 0, "y": 0}, {"x": 0, "y": 1}, {"x": 1, "y": 1}, {"x": 1, "y": 2}],
                "target": {"x": 4, "y": 3},
                "spawn": {"x": 3, "y": 5},
                "color": "#cf7399"
            }
        ]
        break

with open("src/assets/levels.json", "w") as f:
    json.dump(levels, f, indent=4)

