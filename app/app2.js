/* Train Buffer app controller. Data: data/search.json (train list)
   plus one small file per train under data/t/ (counts, n >= 30
   per pair). No server, no tracking, no accounts. */
(function () {
  "use strict";
  var R = window.TrainBufferRisk;
  var els = {};
  ["trainSearch", "stationSelect", "trainMatches", "bufferSlider",
   "bufferValue", "answer", "answerHint", "terrain", "terrainCap"].forEach(function (id) {
    els[id] = document.getElementById(id);
  });

  var DATA = null, currentTrain = null, currentStation = null, currentPairs = null;
  var shardCache = {};
  var terrain = new window.DelayTerrain(els.terrain);

  function fmtBuffer(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? (h + " h " + (m ? String(m).padStart(2, "0") : "00")) : (m + " min");
  }

  /* The data ships sharded: search.json (train numbers + names +
     meta, ~80 KB) loads first, then ONE small file per train on
     selection (data/t/<first-4-digits>.json) — no 10 MB download
     before the first answer. */
  fetch("data/search.json")
    .then(function (r) { return r.json(); })
    .then(function (json) {
      DATA = { meta: json.meta, list: json.trains, byNum: {} };
      json.trains.forEach(function (row) { DATA.byNum[row[0]] = row[1]; });
      els.answerHint.textContent = "Pick your train and the station where you get down. " +
        DATA.meta.rows_used.toLocaleString("en-IN") + " recorded stops, " + DATA.meta.window + ".";
      els.trainSearch.addEventListener("input", onSearch);
      /* The 3D terrain must be visible on first load, not hidden
         behind a train pick: open with the Mumbai Rajdhani into
         New Delhi (12951, 61 runs) as the live demo. The user can
         change train or station above and the shape becomes theirs. */
      var demoTrain = DATA.byNum["12951"] ? "12951" : (DATA.list[0] ? DATA.list[0][0] : null);
      if (demoTrain) pickTrain(demoTrain, "NDLS");
    })
    .catch(function () {
      els.answerHint.textContent = "The data file did not load. Check your connection and refresh.";
    });

  function loadShard(trainNum) {
    var prefix = trainNum.slice(0, 4);
    if (shardCache[prefix]) return Promise.resolve(shardCache[prefix]);
    return fetch("data/t/" + prefix + ".json")
      .then(function (r) { return r.json(); })
      .then(function (shard) { shardCache[prefix] = shard; return shard; });
  }

  function onSearch() {
    var q = els.trainSearch.value.trim().toLowerCase();
    els.trainMatches.innerHTML = "";
    if (!DATA || q.length < 2) return;
    var hits = [];
    DATA.list.forEach(function (row) {
      var num = row[0], name = row[1] || "";
      if (num.indexOf(q) === 0 || name.toLowerCase().indexOf(q) !== -1) {
        hits.push({ num: num, name: name });
      }
    });
    hits.slice(0, 12).forEach(function (hit) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.setAttribute("role", "option");
      var num = document.createElement("span"); num.className = "num"; num.textContent = hit.num;
      btn.appendChild(num);
      btn.appendChild(document.createTextNode("  " + (hit.name || "")));
      btn.addEventListener("click", function () { pickTrain(hit.num); });
      els.trainMatches.appendChild(btn);
    });
    if (!hits.length) {
      var p = document.createElement("p"); p.className = "muted";
      p.textContent = "That train is not in the year's records this page can use — the openly licensed data does not cover every train. If the number is right, this is a gap in the data, not in your ticket.";
      els.trainMatches.appendChild(p);
    }
  }

  function pickTrain(num, station) {
    currentTrain = num;
    els.trainSearch.value = num + "  " + (DATA.byNum[num] || "");
    els.trainMatches.innerHTML = "";
    currentPairs = null;
    els.stationSelect.innerHTML = "";
    els.stationSelect.disabled = true;
    loadShard(num).then(function (shard) {
      var info = shard.trains[num];
      if (!info) throw new Error("train missing from its shard");
      currentPairs = shard.pairs;
      var stations = info.stations.slice().sort();
      stations.forEach(function (code) {
        var opt = document.createElement("option");
        opt.value = code; opt.textContent = code;
        els.stationSelect.appendChild(opt);
      });
      els.stationSelect.disabled = false;
      currentStation = (station && stations.indexOf(station) !== -1) ? station : stations[0];
      els.stationSelect.value = currentStation;
      els.stationSelect.onchange = function () { currentStation = els.stationSelect.value; update(); };
      els.bufferSlider.disabled = false;
      update();
    }).catch(function () {
      els.answerHint.textContent = "That train's data did not load. Check your connection and try again.";
    });
  }

  function pair() {
    if (!currentPairs || !currentTrain || !currentStation) return null;
    return currentPairs[currentTrain + "|" + currentStation] || null;
  }

  function update() {
    var p = pair();
    var buffer = +els.bufferSlider.value;
    els.bufferValue.textContent = fmtBuffer(buffer);
    if (!p) {
      els.answer.innerHTML = "";
      var hint = document.createElement("p"); hint.className = "muted";
      hint.textContent = "Not enough recorded runs for this train at this station — this page does not guess.";
      els.answer.appendChild(hint);
      return;
    }
    var v = R.verdict(p, DATA.meta.buffers, buffer);
    var name = DATA.byNum[currentTrain] || "";
    els.answer.innerHTML = "";
    var big = document.createElement("p"); big.className = "big";
    var lead = document.createTextNode(currentTrain + " " + name + " at " + currentStation + ": ");
    big.appendChild(lead);
    var num = document.createElement("span");
    num.className = v.safe ? "safe-num" : "risk-num";
    num.textContent = v.phrase ? v.phrase : v.pct + "%";
    big.appendChild(num);
    big.appendChild(document.createTextNode(
      " arrived later than your " + fmtBuffer(buffer) + " buffer (" + v.pct + "% of " + p.n + " runs)."));
    els.answer.appendChild(big);
    var rec = document.createElement("p"); rec.className = "rec";
    rec.textContent = "To keep that risk under 5%, leave " + fmtBuffer(p.buffer_5) +
      ". Under 10%: " + fmtBuffer(p.buffer_10) + ".";
    els.answer.appendChild(rec);
    var meta = document.createElement("p"); meta.className = "meta";
    meta.textContent = "Counted from " + p.n + " runs · median delay " + Math.round(p.p50) +
      " min · 9 in 10 runs within " + Math.round(p.p90) + " min · data " + DATA.meta.window;
    els.answer.appendChild(meta);
    els.terrainCap.textContent = "Showing " + currentTrain + " " + name + " into " + currentStation +
      " — the ridge is this train's real lateness. The wall is your buffer; everything red beyond it is the chance you miss your connection. Its heights are stretched and its minutes spread on a square-root scale so the shape reads — the chances are the counted ones, unchanged. Change the train above and the shape becomes yours.";
    terrain.setData(R.survivalPoints(p, DATA.meta.buffers), buffer);
  }

  els.bufferSlider.addEventListener("input", function () {
    els.bufferValue.textContent = fmtBuffer(+els.bufferSlider.value);
    var p = pair();
    if (p) { update(); }
    terrain.setBuffer(+els.bufferSlider.value);
  });
  document.querySelectorAll(".chip[data-buffer]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      els.bufferSlider.value = chip.dataset.buffer; update();
    });
  });
  document.querySelectorAll(".chip[data-target]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var p = pair(); if (!p) return;
      els.bufferSlider.value = chip.dataset.target === "5" ? p.buffer_5 : p.buffer_10;
      update();
    });
  });
})();
