# Train Buffer — data findings (verified 24 Nov 2026)

Source: HF `prabh21243343/indian-railways-delays`, config
`2025-02-08_2026-02-07` (converted from the Kaggle dataset by
rxydenxd, "published under the MIT licence" per the dataset card;
dataset-level licence field: cc-by-4.0; card caveat: the converted
config's upstream is unstated).

Sample pulled: 4 daily parquet files (2025-03-15, 07-15, 11-15,
2026-01-15) = 191,828 stop-rows, 16 run-days, 3,941 trains,
7,521 stations.

Verified:
- Columns exactly as researched: train_number, train_name, category,
  start_date, status, seq, station_code, scheduled/actual arrival +
  departure, arrival_delay_min, departure_delay_min.
- 93% of rows carry actual_arrival + arrival_delay_min.
  Delay distribution (sample): median 14 min, p90 74 min, max 711 min.
- The core statistic computes cleanly: P(arrival_delay > buffer)
  per train x station, with run counts.

Material caveat (changes the design):
- `arrival_reported`, `departure_reported` are ALL None and
  `run_quality` is ALL NaN in this converted config — the conversion
  dropped the NTES quality flags. We therefore CANNOT filter
  estimated times in v1. The daily NTES config has the flags but its
  licence is unstated, so it stays verify-before-use (not used).
- Product consequence: every answer shows its run count + data
  window; answers refuse below 30 runs; the limitation is stated on
  the page, not buried. Month/season slicing only where counts allow.

Next data step: pull ~60 day-files (~28 MB) for the shipped
aggregate; evaluation = strict time split (build Feb-Aug 2025,
test Sep 2025-Feb 2026), Brier score vs the average-delay baseline.

## Coverage check (24 Nov 2026, after the full pull)
- Shipped aggregate: 44,693 train x station pairs, 3,060 trains,
  2,721,233 deduped stop-rows (61 day-files, every 6th day).
- 12951 Mumbai Rajdhani present (NDLS n=61). But 12301 (Howrah
  Rajdhani) and 12266 are ENTIRELY ABSENT from the converted config —
  a coverage gap in the source, verified by direct string-key lookup
  (train_number is a zero-padded string; an integer comparison
  briefly suggested a pipeline bug — it was the check that was wrong).
- Product copy handles absence honestly (data gap, not user error);
  the search placeholder uses 12951, a train verified present.
- Time-split evaluation (build < 2025-09-01, test >=, 26,239 pairs):
  Brier at 60/120/180 min — ours 0.075/0.033/0.017 vs average-delay
  rule 0.105/0.042/0.020 vs global rate 0.110/0.044/0.021.
  Full table + calibration: EVALUATION.md.
