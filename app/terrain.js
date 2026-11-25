/* Train Buffer "Delay Terrain" — the empirical survival curve of
   arrival delay as a 3D ridge, with a translucent wall at the user's
   buffer. Ridge beyond the wall is signal red: that share IS the
   miss probability. 2D canvas fallback draws the same curve.
   Display note: ridge height is a UNIFORM vertical stretch of the
   survival probability (HEIGHT_SCALE below) — it changes how tall
   the shape reads, never the probabilities, the answer numbers,
   or the ordering of any two points. See design/3D_EXPERIENCE_SPEC.md. */
(function () {
  "use strict";
  var WIDTH = 24, MAX_MIN = 360;
  /* Uniform display stretch only. p = 0.246 (the live demo train's
     P(>0)) reads 0.1 + 0.246*9 = 2.31 units tall; p = 0.033 at the
     120-min wall reads 0.40. Same factor for every point, so the
     shape's proportions are the data's proportions, just taller. */
  var HEIGHT_SCALE = 9, RIBBON_HALF = 2.0;
  function ridgeY(p) { return 0.1 + p * HEIGHT_SCALE; }

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
      /* Lower, closer, more side-on than before (-10, 6.5, 13):
         a low elevation angle makes vertical extent read, and the
         nearer camera fills the frame with the ridge instead of
         the pale floor. lookAt y tracks the taller ridge. */
      this.camera.position.set(-10, 5.2, 12.5);
      this.camera.lookAt(0.5, 1.2, 0);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      var key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(5, 10, 7); this.scene.add(key);
      /* Fill from the camera side so the ridge's near vertical face
         (the face the viewer actually sees) is lit, not in shade. */
      var fill = new THREE.DirectionalLight(0xfff2dd, 0.5);
      fill.position.set(-6, 4, 10); this.scene.add(fill);
      /* Tighter floor (was 70x26): the old expanse of pale plane
         dwarfed a ~2-unit ridge. 36x16 still frames it with margin. */
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 16),
        new THREE.MeshStandardMaterial({ color: 0xe7ddc8, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; this.scene.add(floor);
      /* Faint floor grid for depth: squashed square grid (32x16
         cells of 2) so the eye can judge the ridge's height and
         the wall's position against the floor. */
      var grid = new THREE.GridHelper(32, 16, 0xbfae87, 0xd5c9ab);
      grid.scale.z = 0.5; grid.position.y = 0;
      grid.material.transparent = true; grid.material.opacity = 0.5;
      this.scene.add(grid);
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
      var x = xOf(p.x), y = ridgeY(p.y);
      /* Ribbon half-depth 2.0 (was 1.1): a deeper slab shows a
         real vertical side face to the camera, so the ridge reads
         as a raised solid instead of a thin fin. Depth is display
         only; x and y are the data. */
      verts.push(x, 0, -RIBBON_HALF, x, y, -RIBBON_HALF, x, y, RIBBON_HALF, x, 0, RIBBON_HALF);
    });
    for (var i = 0; i < pts.length - 1; i++) {
      var a = i * 4, b = a + 4;
      idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2, a + 2, b + 2, a + 3, b + 2, b + 3, a + 3);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    /* The red (risk) ribbon gets a faint warm emissive lift so its
       shaded side still reads signal red; the grey ribbon stays flat. */
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.55, metalness: 0.1 });
    if (color === 0xc8372d) { mat.emissive = new THREE.Color(0x2a0705); }
    return new THREE.Mesh(geo, mat);
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
    /* Wall spans the full ribbon depth and stands well above the
       ridge where it cuts it (0.40 at the demo train's 120-min
       wall) and above the demo peak (2.31), with a solid red top
       bar so its edge reads even where the translucent plane
       washes out against the pale floor. Opacity 0.30 (was 0.22).
       A chronically late train's far-left peak can exceed the
       wall — the wall marks a buffer, not a ceiling. */
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 6.5),
      new THREE.MeshBasicMaterial({ color: 0xc8372d, transparent: true, opacity: 0.30, side: THREE.DoubleSide }));
    wall.position.set(xOf(this.buffer), 3.25, 0);
    this.group.add(wall);
    var wallTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.6),
      new THREE.MeshBasicMaterial({ color: 0xc8372d }));
    wallTop.position.set(xOf(this.buffer), 6.5, 0);
    this.group.add(wallTop);
    // grid markers at the real data points — no invented smoothness
    var dotGeo = new THREE.SphereGeometry(0.15, 8, 8);
    var dotMat = new THREE.MeshBasicMaterial({ color: 0x1c2434 });
    this.points.forEach(function (p) {
      var d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(xOf(p.x), ridgeY(p.y), 0);
      this.group.add(d);
    }.bind(this));
    this._render();
  };
  DelayTerrain.prototype._render = function () {
    if (this.mode === "3d" && this.renderer) this.renderer.render(this.scene, this.camera);
  };

  window.DelayTerrain = DelayTerrain;
})();
