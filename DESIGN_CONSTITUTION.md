# Train Buffer — Design Constitution

**Product in one line:** Tell it your train, your station and the
connection you cannot miss. It answers with the one number that
matters — how often this train, at this station, arrived later than
the buffer you are planning — counted from a year of real runs.

**Identity: "The printed timetable, brought back honest."** Cream
paper ground, ink-navy text, signal red reserved for risk and nothing
else. Tabular mono numerals everywhere a number appears — this is a
numbers product and it should look like one. No gradients, no stock
photos of trains, no fake "AI prediction" language: every figure is a
count from recorded runs, and the page says so.

## Visual grammar
- Ground: warm paper `#f6f1e7`; panels `#fffdf7`; ink `#1c2434`.
- Accent: signal red `#c8372d` — used ONLY for the risk mass, the
  miss probability, and warnings. Everything else is ink + one
  railway green `#1f6f4a` for "within your buffer" states.
- Type: "Fraunces" for display, "Inter" for UI, "IBM Plex Mono" for
  every number (times, counts, probabilities).
- The answer is typeset like a timetable entry: big mono figures,
  hairline rules, no cards-within-cards.

## Layout (problem → solution → outcome)
1. The tool itself first: train search → station → buffer slider →
   answer. The product is the page.
2. "Why averages lie" — one short section: the same train can average
   25 minutes late and still kill a 2-hour connection one day in
   eight. Averages hide the tail; connections die in the tail.
3. "How this was checked" — the time-split evaluation with real
   Brier scores vs the average-delay rule (from EVALUATION.md).
4. "Honest limits" — data window, run counts, the missing quality
   flags in the openly licensed config, no live running status.

## Voice
Plain railway language. "1 in 8 runs" before percentages. Never
"AI-powered prediction" — it is counting, done carefully, and the
page is proud of that.
