# Train Buffer — 3D Experience Spec: "The Delay Terrain"

## What it is
For the chosen train at the chosen station, the empirical survival
curve of arrival delay — P(arriving later than t) for t = 0..360+
minutes — drawn as a solid 3D cliff: the profile filled down to
the floor and extruded with real depth (Three.js). A translucent
vertical "buffer wall" stands at the user's chosen buffer. The ridge
mass beyond the wall is coloured signal red; its share of the whole
is exactly the miss probability in the answer card. Move the buffer
slider and the wall slides, the red share changes, the number follows.

## Why this is meaningful, not decorative
The product's whole claim is that the *shape* of lateness — not its
average — decides connections. The terrain makes that shape visible:
a long flat tail is a dangerous train even with a small average, and
you can see it before you read a single number. Remove the terrain
and the user is back to trusting one figure. It is the chart, in 3D,
because the distribution is the product.

## Data honesty
- The ridge is drawn from the pair's precomputed risk grid
  (15..360 min, empirical, from the shipped aggregate) with monotone
  interpolation — no invented smoothness: grid points are marked.
- Display transforms, disclosed in the on-page caption: height is a
  uniform vertical stretch of the probability (×14), and the minute
  axis uses a square-root spread so the early minutes get room; the
  wall and the grid dots use the same mapping. Neither transform
  changes any probability, answer number, or ordering.
- Camera framing is fit-checked whenever the scene is built: the
  profile points, base corners and wall-top corners are projected
  through the placed camera and the distance adjusted so nothing —
  the peak included — is cropped at the canvas edge, with the shape
  still filling most of the frame. Framing changes no data value.
- Below 30 runs there is no terrain and no answer — the page says why.
- Reduced motion: static camera; the wall still moves with the
  slider (that movement is the information, kept minimal).
- Fallback: a flat 2D SVG survival curve with the same wall + red
  tail, identical numbers. WebGL is an enhancement, never a gate.

## Performance
- One canvas, one ridge geometry (≤ 25 points), DPR capped at 1.5,
  render on demand (slider / resize / data change only).
- The aggregate JSON (10 MB raw, ~1.5-2 MB gzipped) lazy-loads after
  first paint; the page explains itself while data loads.

# Interaction inventory (every control works; nothing decorative)
- Train search (number or name, from the shipped index) · station
  select (only stations with ≥30 recorded runs for that train) ·
  buffer slider 15–360 min + preset chips (1h, 2h, 3h) · risk-target
  buttons "keep my risk under 5% / 10%" → sets the slider to the
  counted buffer · answer card (1-in-X, %, recommended buffers,
  runs + window + median/p90) · terrain (drag slider = wall moves) ·
  "how this was checked" anchor → evaluation section.
- Refusal state: a pair under 30 runs shows the count and declines
  to answer. An unknown train shows how to check the number format.
