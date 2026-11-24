# Train Buffer — evaluation (strict time split)

Build period: before 2025-09-01 (1,534,701 rows). Test period: from 2025-09-01 (1,186,532 rows).
Pairs evaluated: train x station with n_build >= 30 and n_test >= 20.

Pairs actually evaluated: 26,239

| Buffer | Ours (Brier) | Average-delay rule (Brier) | Global base rate (Brier) |
|---|---|---|---|
| 60 min | 0.0753 | 0.1051 | 0.1097 |
| 120 min | 0.0334 | 0.0421 | 0.0438 |
| 180 min | 0.0170 | 0.0196 | 0.0210 |

Lower Brier is better. The average-delay rule is what incumbent train apps effectively show (one mean number); the global rate is the no-information baseline.

## Calibration (buffer 120 min)

| Predicted risk | Observed miss rate | Test runs |
|---|---|---|
| 0-10% | 0.02 | 605,115 |
| 10-20% | 0.17 | 26,323 |
| 20-30% | 0.24 | 11,079 |
| 30-40% | 0.35 | 7,155 |
| 40-50% | 0.40 | 5,543 |
| 50-60% | 0.46 | 4,101 |
| 60-70% | 0.56 | 1,902 |
| 70-80% | 0.77 | 739 |
| 80-90% | 0.94 | 754 |
| 90-100% | 0.95 | 1,978 |
