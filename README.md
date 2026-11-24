# Train Buffer

**Averages lie. This counts.**

Every train site tells you one number per station: the *average*
delay. But connections are not killed by the average day — they are
killed by the bad tail. Train Buffer answers the booking-time
question that actually matters:

> On how many of its recorded runs did **this train**, at **this
> station**, arrive later than the buffer you are planning?

And the reverse: the buffer that would have kept your risk under
5% or 10%, counted from the same runs.

## The proof (strict time split)
Probabilities computed from runs **before** Sep 2025, scored against
what actually happened **from** Sep 2025, across 26,239
train-and-station pairs. Brier score, lower is better:

| Buffer | This method | Average-delay rule | One global rate |
|---|---|---|---|
| 60 min | **0.075** | 0.105 | 0.110 |
| 120 min | **0.033** | 0.042 | 0.044 |
| 180 min | **0.017** | 0.020 | 0.021 |

Full method + calibration table: `EVALUATION.md`.

## Data
- Hugging Face `prabh21243343/indian-railways-delays`, converted
  config `2025-02-08_2026-02-07` — "published under the MIT licence"
  per the dataset card (its upstream is unstated; the daily NTES
  config is NOT used — licence unstated).
- 61 day-files pulled (every 6th day, Feb 2025 – Feb 2026),
  deduped to 2,721,233 stop-rows; 44,693 train×station pairs with
  ≥30 runs. The app ships them sharded — `app/data/index.json` plus
  a compact `app/data/search.json` plus one small file per train in `app/data/t/` —
  so a phone loads ~250 KB, not the 10 MB monolith (which the build
  also writes locally as `aggregate.json` for analysis).
- Rebuild: `scripts/build_aggregate.py` (needs pandas + pyarrow).

## Honest limits
- The converted config **lost the NTES quality flags**
  (`arrival_reported`, `run_quality` are all null), so figures
  include system-estimated times. Every answer shows its run count;
  the page states this openly.
- Coverage: 3,060 trains. Some famous ones (12301 Howrah Rajdhani)
  are absent from the openly licensed copy — the UI says so plainly
  instead of pretending.
- Below 30 runs for a pair, the app refuses to answer.
- History is not prophecy: same-day disruption is not in the counts.

## The app
Static — `app/` is the deployable unit (no server, no keys, no
tracking). The 3D "Delay Terrain" is the survival curve of delay as
a ridge with a wall at your buffer; the red mass beyond the wall is
your miss probability. 2D fallback included. Design:
`DESIGN_CONSTITUTION.md` + `design/`.

## Tests
```
node tests/test_risk.mjs   # interpolation, clamping, phrasing, verdicts
```
