import re

with open('src/screens/PlayScreen.tsx', 'r') as f:
    content = f.read()

# Build the new ImageAssets string
assets = "const ImageAssets: Record<string, any> = {\n"
for i in range(1, 31):
    assets += f"    'img{i}': require('../assets/images/img{i}.jpg'),\n"
assets += "}\n"

# Replace the old ImageAssets block
content = re.sub(
    r"const ImageAssets: Record<string, any> = \{.*?\n\}",
    assets,
    content,
    flags=re.DOTALL
)

with open('src/screens/PlayScreen.tsx', 'w') as f:
    f.write(content)
