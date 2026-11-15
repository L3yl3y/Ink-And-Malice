import sys
src, words, out_art, out_std = sys.argv[1:5]
t = open(src, encoding="utf-8").read()
w = open(words, encoding="utf-8").read()
assert "__WORDS__" in t and "<!--HEAD-END-->" in t
page = t.replace("__WORDS__", w)
head, body = page.split("<!--HEAD-END-->", 1)
open(out_art, "w", encoding="utf-8").write(head + body.lstrip("\n"))
std = ('<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       + head + '</head>\n<body>\n' + body.lstrip("\n") + '</body>\n</html>\n')
open(out_std, "w", encoding="utf-8").write(std)
print("artifact", len(page), "standalone", len(std))
