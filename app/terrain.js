/* Train Buffer "Delay Terrain" — the empirical survival curve of
   arrival delay as a 3D ridge, with a translucent wall at the user's
   buffer. Ridge beyond the wall is signal red: that share IS the
   miss probability. 2D canvas fallback draws the same curve.
   See design/3D_EXPERIENCE_SPEC.md. */
(function () {
  "use strict";
  var WIDTH = 24, MAX_MIN = 360;

  function DelayTerrain(canvas) {
    this.canvas = canvas;
    this.points = null;   // [{x: minutes, y: P(>x)}]
    this.buffer = 120;
    this.mode = "2d";
    this._tryInit3D();
    if (this.mode !== "3d") this._draw2D();
  }

  DelayTerrain.prototype.setData = function (points, bufferMin) {
    this.points = points; this.buffer = bufferMin;
    if (this.mode === "3d") this._build(); else this._draw2D();
  };
  DelayTerrain.prototype.setBuffer = function (bufferMin) {
    this.buffer = bufferMin;
    if (this.mode === "3d") this._build(); else this._draw2D();
  };

  function xOf(min) { return -WIDTH / 2 + (min / MAX_MIN) * WIDTH; }

  DelayTerrain.prototype._draw2D = function () {
    var ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    var w = this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    var h = this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#efe8d8"; ctx.fillRect(0, 0, w, h);
    if (!this.points) return;
    var pad = 8 * (window.devicePixelRatio || 1);
    var px = function (min) { return pad + (min / MAX_MIN) * (w - 2 * pad); };
    var py = function (p) { return h - pad - p * (h - 2 * pad); };
    // risk tail fill
    ctx.beginPath();
    var started = false;
    this.points.forEach(function (pt) {
      if (pt.x < this.buffer) return;
      if (!started) { ctx.moveTo(px(this.buffer), py(interp(this.points, this.buffer))); started = true; }
      ctx.lineTo(px(pt.x), py(pt.y));
    }.bind(this));
    ctx.lineTo(px(MAX_MIN), py(0)); ctx.lineTo(px(this.buffer), py(0)); ctx.closePath();
    ctx.fillStyle = "rgba(200,55,45,0.35)"; ctx.fill();
    // curve
    ctx.beginPath();
    this.points.forEach(function (pt, i) {
      if (i === 0) ctx.moveTo(px(pt.x), py(pt.y)); else ctx.lineTo(px(pt.x), py(pt.y));
    });
    ctx.strokeStyle = "#1c2434"; ctx.lineWidth = 2 * (window.devicePixelRatio || 1); ctx.stroke();
    // wall
    ctx.beginPath(); ctx.moveTo(px(this.buffer), pad); ctx.lineTo(px(this.buffer), h - pad);
    ctx.strokeStyle = "#c8372d"; ctx.lineWidth = 2.5 * (window.devicePixelRatio || 1); ctx.stroke();
  };

  function interp(points, x) {
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      if (x >= a.x && x <= b.x) return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
    }
    return points[points.length - 1].y;
  }

  DelayTerrain.prototype._tryInit3D = function () {
    if (typeof THREE === "undefined") return;
    try {
      var renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer = renderer;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xefe8d8);
      this.camera = new THREE.PerspectiveCamera(40, 2, 0.1, 100);
      this.camera.position.set(-10, 6.5, 13);
      this.camera.lookAt(1.5, 0.8, 0);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      var key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(5, 10, 7); this.scene.add(key);
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 26),
        new THREE.MeshStandardMaterial({ color: 0xe7ddc8, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; this.scene.add(floor);
      this.group = new THREE.Group(); this.scene.add(this.group);
      this.mode = "3d";
      this._resize();
      var self = this;
      window.addEventListener("resize", function () { self._resize(); self._render(); });
    } catch (err) { this.mode = "2d"; this.renderer = null; }
  };
  DelayTerrain.prototype._resize = function () {
    if (!this.renderer) return;
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.updateProjectionMatrix();
  };
  function ribbon(points, fromX, toX, color) {
    var verts = [], idx = [];
    var pts = points.filter(function (p) { return p.x >= fromX && p.x <= toX; });
    if (!pts.length || pts[0].x > fromX) pts.unshift({ x: fromX, y: interp(points, fromX) });
    if (pts[pts.length - 1].x < toX) pts.push({ x: toX, y: interp(points, toX) });
    pts.forEach(function (p) {
      var x = xOf(p.x), y = 0.1 + p.y * 5.2;
      verts.push(x, 0, -1.1, x, y, -1.1, x, y, 1.1, x, 0, 1.1);
    });
    for (var i = 0; i < pts.length - 1; i++) {
      var a = i * 4, b = a + 4;
      idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2, a + 2, b + 2, a + 3, b + 2, b + 3, a + 3);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, roughness: 0.55, metalness: 0.1 }));
  }
  DelayTerrain.prototype._build = function () {
    if (this.mode !== "3d") return;
    while (this.group.children.length) {
      var c = this.group.children.pop();
      if (c.geometry) c.geometry.dispose();
    }
    if (!this.points) { this._render(); return; }
    this.group.add(ribbon(this.points, 0, this.buffer, 0x8b93a1));
    this.group.add(ribbon(this.points, this.buffer, MAX_MIN, 0xc8372d));
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.6),
      new THREE.MeshBasicMaterial({ color: 0xc8372d, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    wall.position.set(xOf(this.buffer), 2.8, 0);
    this.group.add(wall);
    // grid markers at the real data points — no invented smoothness
    var dotGeo = new THREE.SphereGeometry(0.11, 8, 8);
    var dotMat = new THREE.MeshBasicMaterial({ color: 0x1c2434 });
    this.points.forEach(function (p) {
      var d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(xOf(p.x), 0.1 + p.y * 5.2, 0);
      this.group.add(d);
    }.bind(this));
    this._render();
  };
  DelayTerrain.prototype._render = function () {
    if (this.mode === "3d" && this.renderer) this.renderer.render(this.scene, this.camera);
  };

  window.DelayTerrain = DelayTerrain;
})();
