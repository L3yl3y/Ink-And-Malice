# Ink And Malice

An original word-duel game for 2 to 5 players. Spell a word, cast it at a rival, and make them beat your score before the sand runs out. Lose three seals and you are out.

**Play it:** https://l3yl3y.github.io/Ink-And-Malice/

## Modes

- **Practice**: duel 1 to 4 bots (Apprentice, Scholar or Archmage). A coach shows the strongest word you had after each turn, and a Hint button shows it during your turn.
- **Pass And Play**: share one screen; each player's glyphs stay hidden until they tap in.
- **Play Online**: one player creates a room and shares the 5-letter code; the others join with it. Browsers connect directly through the free PeerJS service, and the host keeps the page open while you play. Empty seats can be filled with bots.

## Build And Test

- `tools/make.sh` rebuilds `dist/artifact.html`, `dist/index.html` and `docs/index.html` (the GitHub Pages site) from `src/ink-malice.src.html` and `src/words.enc`.
- `node tools/sim.js 300` plays 300 bot games and checks every glyph is accounted for after each move.
- `tools/uitest.js`, `tools/nettest.js peer` and `tools/nettest.js cloud` drive headless Chrome (run `npm install` in `tools` and serve `dist` on port 8790 first).

## Credits

- Word list: ENABLE (public domain).
- Common-word flags for the bots: derived from hermitdave/FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0.
- Words excluded from bot and hint play: LDNOOBW list, CC BY 4.0.
- Online rooms: PeerJS.
