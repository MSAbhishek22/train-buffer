#!/usr/bin/env python3
"""Train Buffer — build the shipped aggregate + run the time-split evaluation.

Data: HF prabh21243343/indian-railways-delays, config
2025-02-08_2026-02-07 (MIT per dataset card), daily parquets in
data_raw/ (61 files, every 6th day, Feb 2025 - Feb 2026).

Outputs:
  app/data/aggregate.json  — per train x station risk tables (n >= 30)
  EVALUATION.md            — strict time-split Brier vs baselines

Adjacent day-files overlap run-days, so rows are deduped on
(train_number, start_date, station_code, seq) before any counting.
"""
import glob
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent.parent
BUFFERS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360]
MIN_RUNS = 30
SPLIT_DATE = pd.Timestamp("2025-09-01")


def load() -> pd.DataFrame:
    frames = [pd.read_parquet(f) for f in sorted(glob.glob(str(ROOT / "data_raw" / "*.parquet")))]
    df = pd.concat(frames, ignore_index=True)
    df = df.drop_duplicates(subset=["train_number", "start_date", "station_code", "seq"])
    df = df[df.arrival_delay_min.notna()].copy()
    df["start_date"] = pd.to_datetime(df["start_date"])
    return df


def risk_row(delays: np.ndarray) -> dict:
    n = len(delays)
    row = {
        "n": int(n),
        "mean": round(float(np.mean(delays)), 1),
        "p50": round(float(np.quantile(delays, 0.50)), 1),
        "p75": round(float(np.quantile(delays, 0.75)), 1),
        "p90": round(float(np.quantile(delays, 0.90)), 1),
        "p95": round(float(np.quantile(delays, 0.95)), 1),
        "risk": {str(b): round(float((delays > b).mean()), 3) for b in BUFFERS},
    }
    for target in (0.05, 0.10):
        q = float(np.quantile(delays, 1 - target))
        row[f"buffer_{int(target * 100)}"] = int(np.ceil(q / 5.0) * 5)
    return row


def main() -> None:
    df = load()
    print(f"rows after dedupe + delay filter: {len(df):,}")

    pairs: dict[str, dict] = {}
    trains: dict[str, dict] = {}
    for (train, station), group in df.groupby(["train_number", "station_code"]):
        if len(group) < MIN_RUNS:
            continue
        key = f"{train}|{station}"
        pairs[key] = risk_row(group.arrival_delay_min.to_numpy())
        name = str(group.train_name.iloc[0] or "")
        entry = trains.setdefault(str(train), {"name": name, "stations": []})
        entry["stations"].append(str(station))

    out = {
        "meta": {
            "source": "Hugging Face prabh21243343/indian-railways-delays, config 2025-02-08_2026-02-07 (MIT, per dataset card)",
            "rows_used": int(len(df)),
            "window": f"{df.start_date.min().date()} to {df.start_date.max().date()}",
            "min_runs": MIN_RUNS,
            "buffers": BUFFERS,
            "note": "Converted config: NTES quality flags are absent, so figures include estimated times. Every answer shows its run count.",
        },
        "trains": trains,
        "pairs": pairs,
    }
    app_data = ROOT / "app" / "data"
    app_data.mkdir(parents=True, exist_ok=True)
    (app_data / "aggregate.json").write_text(json.dumps(out, separators=(",", ":")))
    size_mb = (app_data / "aggregate.json").stat().st_size / 1e6
    print(f"pairs shipped (n>={MIN_RUNS}): {len(pairs):,} | trains: {len(trains):,} | aggregate.json {size_mb:.1f} MB")

    # Sharded form for the web app + GitHub: the monolith is too big
    # to push through the GitHub connector (per-file limit ~114 KB)
    # and too big to make a phone download before the first answer.
    # Layout: data/search.json = [[number, name], ...] for search;
    # data/t/<4-digit prefix>.json = that prefix's trains + pairs.
    import shutil
    shard_dir = app_data / "t"
    if shard_dir.exists():
        shutil.rmtree(shard_dir)
    shard_dir.mkdir()
    by_prefix: dict[str, dict] = {}
    for key, row in pairs.items():
        num = key.split("|")[0]
        by_prefix.setdefault(num[:4], {"trains": {}, "pairs": {}})["pairs"][key] = row
    for num, tinfo in trains.items():
        by_prefix.setdefault(num[:4], {"trains": {}, "pairs": {}})["trains"][num] = tinfo
    biggest = 0
    for prefix, payload in by_prefix.items():
        f = shard_dir / f"{prefix}.json"
        f.write_text(json.dumps(payload, separators=(",", ":")))
        biggest = max(biggest, f.stat().st_size)
    (app_data / "search.json").write_text(json.dumps(
        {"meta": out["meta"],
         "trains": sorted(([num, t["name"]] for num, t in trains.items()))},
        separators=(",", ":")))
    print(f"prefix files: {len(by_prefix)} | biggest {biggest / 1024:.0f} KB | "
          f"search.json {(app_data / 'search.json').stat().st_size / 1024:.0f} KB")

    # ---- strict time-split evaluation ----
    build = df[df.start_date < SPLIT_DATE]
    test = df[df.start_date >= SPLIT_DATE]
    lines = ["# Train Buffer — evaluation (strict time split)", "",
             f"Build period: before {SPLIT_DATE.date()} ({len(build):,} rows). "
             f"Test period: from {SPLIT_DATE.date()} ({len(test):,} rows).",
             f"Pairs evaluated: train x station with n_build >= {MIN_RUNS} and n_test >= 20.", ""]
    build_groups = {k: g.arrival_delay_min.to_numpy() for k, g in build.groupby(["train_number", "station_code"])}
    global_rate = {b: float((build.arrival_delay_min > b).mean()) for b in (60, 120, 180)}
    results = {b: {"ours": [], "avg_rule": [], "global": []} for b in (60, 120, 180)}
    calib = {b: [] for b in (60, 120, 180)}
    evaluated = 0
    for key, tgroup in test.groupby(["train_number", "station_code"]):
        bdelays = build_groups.get(key)
        if bdelays is None or len(bdelays) < MIN_RUNS or len(tgroup) < 20:
            continue
        evaluated += 1
        tdelays = tgroup.arrival_delay_min.to_numpy()
        mean_b = float(np.mean(bdelays))
        for b in (60, 120, 180):
            p = float((bdelays > b).mean())
            y = (tdelays > b).astype(float)
            results[b]["ours"].append(np.mean((p - y) ** 2))
            results[b]["avg_rule"].append(np.mean(((1.0 if mean_b > b else 0.0) - y) ** 2))
            results[b]["global"].append(np.mean((global_rate[b] - y) ** 2))
            calib[b].append((p, float(y.mean()), len(y)))
    lines.append(f"Pairs actually evaluated: {evaluated:,}")
    lines.append("")
    lines.append("| Buffer | Ours (Brier) | Average-delay rule (Brier) | Global base rate (Brier) |")
    lines.append("|---|---|---|---|")
    for b in (60, 120, 180):
        r = results[b]
        lines.append(f"| {b} min | {np.mean(r['ours']):.4f} | {np.mean(r['avg_rule']):.4f} | {np.mean(r['global']):.4f} |")
    lines += ["", "Lower Brier is better. The average-delay rule is what incumbent "
              "train apps effectively show (one mean number); the global rate is "
              "the no-information baseline.", "", "## Calibration (buffer 120 min)", "",
              "| Predicted risk | Observed miss rate | Test runs |", "|---|---|---|"]
    buckets: dict[int, list] = {}
    for p, obs, n in calib[120]:
        buckets.setdefault(min(int(p * 10), 9), []).append((obs, n))
    for k in sorted(buckets):
        rows = buckets[k]
        wobs = sum(o * n for o, n in rows) / sum(n for _, n in rows)
        lines.append(f"| {k * 10}-{k * 10 + 10}% | {wobs:.2f} | {sum(n for _, n in rows):,} |")
    (ROOT / "EVALUATION.md").write_text("\n".join(lines) + "\n")
    print(f"evaluated pairs: {evaluated:,}")
    for b in (60, 120, 180):
        r = results[b]
        print(f"buffer {b}: ours={np.mean(r['ours']):.4f} avg_rule={np.mean(r['avg_rule']):.4f} global={np.mean(r['global']):.4f}")


if __name__ == "__main__":
    main()
