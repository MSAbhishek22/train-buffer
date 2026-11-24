# LinkedIn draft 02 — Train Buffer (Data Science lane)
State: DRAFT_READY · package INCOMPLETE (live URL + recording after
deploy) · NOT approved, NOT scheduled.

## Draft copy

Every train website in India shows you the same number: average delay.

Here is the problem with that number. A connection is not killed by
the average day. It is killed by the bad day — the one run in eight
that comes in three hours late. A train can average 25 minutes late
and still end your trip once a month.

So I built a small tool that asks a different question:

"On how many of its recorded runs did THIS train, at THIS station,
arrive later than the time I am leaving for my connection?"

It is called Train Buffer. You pick the train, the station, and your
buffer. It answers in plain words — "1 in 8 runs" — and it can work
backwards: the buffer that keeps your risk under 5%.

The data is a year of real per-run records: 2.7 million station
stops. And because a number you cannot check is just a claim, I
tested the method the strict way. Probabilities from runs before
September 2025, scored against what actually happened after
September 2025, across 26,239 train-and-station pairs. At a 2-hour
buffer, the counting method scored 0.033 against the average-delay
rule's 0.042 (lower is better). Not magic — just the right question,
counted honestly.

Two limits I will state before anyone else has to:

The openly licensed copy of this data lost the flags that mark
which station times were estimates, so every answer on the site
shows its run count, and below 30 runs the site refuses to answer.

And some famous trains are simply missing from that copy — the
Howrah Rajdhani among them. The site says "this is a gap in the
data", because it is.

Next: monthly patterns. Winter fog writes its own timetable in the
north, and the counts should show it.

## Evidence packet
- Incumbent evidence: etrain.info running-history pages read
  directly Nov 2026 (Avg. Delay only + 3 coarse buckets).
- Harm evidence: Lok Sabha punctuality answer (sansad.in) naming
  missed connections + financial losses; ~77% network punctuality.
- Method evidence: EVALUATION.md — time-split Brier table +
  calibration, 26,239 pairs; DATA_FINDINGS.md — coverage + flags.
- Claims NOT made: no live-status claim, no prediction claim,
  no accuracy % beyond the published Brier comparison.
- Missing before approval: live URL, GitHub URL, screen recording.
