#!/bin/sh
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
python3 -I "$R/tools/build.py" "$R/src/ink-malice.src.html" "$R/src/words.enc" "$R/dist/artifact.html" "$R/dist/index.html"
python3 -I -c 'import sys,re; t=open(sys.argv[1],encoding="utf-8").read(); print(re.findall(r"<script>\n(.*?)</script>", t, re.S)[-1])' "$R/src/ink-malice.src.html" > "$R/tools/main.js"
node --check "$R/tools/main.js"
mkdir -p "$R/docs"
cp "$R/dist/index.html" "$R/docs/index.html"
echo BUILD_OK
