import sys, re
dl = sys.argv[1]
out = sys.argv[2]
words = set()
for w in open(dl + "/enable1.txt"):
    w = w.strip().lower()
    if 3 <= len(w) <= 15 and re.fullmatch(r"[a-z]+", w):
        words.add(w)
bad = set()
for line in open(dl + "/bad_en.txt", encoding="utf-8"):
    t = line.strip().lower()
    if re.fullmatch(r"[a-z]+", t):
        bad.add(t)
        bad.add(t + "s")
common = set()
for line in open(dl + "/en_50k.txt", encoding="utf-8"):
    parts = line.split()
    if parts and parts[0] in words:
        common.add(parts[0])
lines = []
prev = ""
nb = 0
for w in sorted(words):
    if w in bad:
        flag = 2
        nb += 1
    elif w in common:
        flag = 1
    else:
        flag = 0
    p = 0
    while p < len(prev) and p < len(w) and prev[p] == w[p] and p < 15:
        p += 1
    base = [ord("a"), ord("A"), ord("0")][flag]
    if flag == 2:
        lines.append("!" + chr(ord("a") + p) + w[p:])
    else:
        lines.append(chr(base + p) + w[p:])
    prev = w
data = "\n".join(lines)
open(out, "w").write(data)
print("words", len(words), "common", len(common & words), "blocked", nb, "bytes", len(data))
