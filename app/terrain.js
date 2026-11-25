/* Train Buffer "Delay Terrain" — the empirical survival curve of
   arrival delay as a solid 3D cliff: the profile filled down to
   the floor and extruded with real depth, with a translucent
   wall at the user's buffer. The solid beyond the wall is signal
   red: that share IS the miss probability. 2D canvas fallback
   draws the same curve.
   Display transforms (both disclosed in the on-page caption;
   neither changes any probability, any answer number, or the
   ordering of any two points):
   - Height: a UNIFORM vertical stretch of the survival
     probability (HEIGHT_SCALE below), same factor everywhere.
   - Minutes: the minute axis is spread on a SQUARE-ROOT scale
     (xOf below) so the early minutes — where the curve actually
     falls — get room, instead of half the frame going to a
     zero-height tail. The wall and the grid-point dots use the
     same mapping, so every mark still sits at its true minute.
   See design/3D_EXPERIENCE_SPEC.md. */
(function () {
  "use strict";
  var WIDTH = 16, MAX_MIN = 360, DEPTH = 5;
  var HEIGHT_SCALE = 14, BASE = 0.15;
  var GREY = 0x8b93a1, RED = 0xc8372d;
  function ridgeY(p) { return BASE + p * HEIGHT_SCALE; }
  function xOf(min) { return -WIDTH / 2 + Math.sqrt(Math.max(0, min) / MAX_MIN) * WIDTH; }

  function DelayTerrain(canvas) {
    this.canvas = canvas;
    this.points = null;   // [{x: minutes, y: P(>x)}]
    this.buffer = 120;
    this.mode = "2d";
    this._peakY = null;
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
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      var key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(5, 10, 7); this.scene.add(key);
      /* Fill from the camera side so the solid's front profile
         face — the face the viewer actually reads — is lit. */
      var fill = new THREE.DirectionalLight(0xfff2dd, 0.5);
      fill.position.set(-6, 4, 10); this.scene.add(fill);
      /* Floor sized to the shape's footprint (was a 36x16 expanse
         that dwarfed the ridge): a margin around the solid, no
         more, with a faint grid so height and wall position can
         be judged against the ground. */
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 5, DEPTH + 5),
        new THREE.MeshStandardMaterial({ color: 0xe7ddc8, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; this.scene.add(floor);
      var grid = new THREE.GridHelper(WIDTH + 4, 10, 0xbfae87, 0xd5c9ab);
      grid.scale.z = (DEPTH + 4) / (WIDTH + 4);
      grid.position.y = 0.001;
      grid.material.transparent = true; grid.material.opacity = 0.5;
      this.scene.add(grid);
      this.group = new THREE.Group(); this.scene.add(this.group);
      this.mode = "3d";
      this._resize();
      this._frameCamera(ridgeY(0.25));
      var self = this;
      window.addEventListener("resize", function () { self._resize(); self._render(); });
    } catch (err) { this.mode = "2d"; this.renderer = null; }
  };
  DelayTerrain.prototype._resize = function () {
    if (!this.renderer) return;
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    if (this._peakY) this._frameCamera(this._peakY);
  };
  /* Frame the whole solid: distance is the larger of what the
     peak height needs (peak ≈ 45% of frame height) and what the
     shape's width needs at the canvas aspect, so neither the
     cliff nor the tail tip is cropped. Mostly frontal, slightly
     left and above, so the filled front profile reads first and
     the depth and start cap read second. Framing is display
     only — it never touches a data value. */
  DelayTerrain.prototype._frameCamera = function (peakY) {
    if (!this.camera) return;
    var target = new THREE.Vector3(0, Math.max(peakY * 0.35, 0.4), 0);
    var halfFovTan = Math.tan(THREE.MathUtils.degToRad(20));
    var distH = peakY / (2 * halfFovTan * 0.45);
    var distW = (WIDTH + 1.5) / (2 * halfFovTan * (this.camera.aspect || 2));
    var dist = Math.min(30, Math.max(9, Math.max(distH, distW)));
    var dir = new THREE.Vector3(-0.32, 0.42, 1).normalize();
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.camera.lookAt(target);
  };
  function segmentPoints(points, fromX, toX) {
    var pts = points.filter(function (p) { return p.x >= fromX && p.x <= toX; });
    if (!pts.length || pts[0].x > fromX) pts.unshift({ x: fromX, y: interp(points, fromX) });
    if (pts[pts.length - 1].x < toX) pts.push({ x: toX, y: interp(points, toX) });
    return pts;
  }
  /* A closed solid: the survival profile filled down to the
     floor, extruded DEPTH deep with end caps — a descending
     cliff with mass from any angle, not a ribbon whose top
     strip is all the camera sees. */
  function solid(points, fromX, toX, color) {
    if (toX - fromX < 1) return null;
    var pts = segmentPoints(points, fromX, toX);
    if (pts.length < 2) return null;
    var shape = new THREE.Shape();
    shape.moveTo(xOf(pts[0].x), 0);
    pts.forEach(function (p) { shape.lineTo(xOf(p.x), ridgeY(p.y)); });
    shape.lineTo(xOf(pts[pts.length - 1].x), 0);
    shape.closePath();
    var geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
    geo.translate(0, 0, -DEPTH / 2);
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.05 });
    /* The red (risk) solid gets a faint warm emissive lift so
       its shaded faces still read signal red. */
    if (color === RED) { mat.emissive = new THREE.Color(0x2a0705); }
    return new THREE.Mesh(geo, mat);
  }
  DelayTerrain.prototype._build = function () {
    if (this.mode !== "3d") return;
    while (this.group.children.length) {
      var c = this.group.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    if (!this.points) { this._render(); return; }
    var peak = 0;
    this.points.forEach(function (p) { if (p.y > peak) peak = p.y; });
    this._peakY = ridgeY(peak);
    var grey = solid(this.points, 0, this.buffer, GREY);
    if (grey) this.group.add(grey);
    var red = solid(this.points, this.buffer, MAX_MIN, RED);
    if (red) this.group.add(red);
    /* The wall is a plane across the solid's depth (rotated to
       span z, not x), standing above the peak, with a solid red
       top bar so its edge reads even where the translucent
       plane washes out against the pale floor. */
    var wallH = this._peakY * 1.12 + 0.35;
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH + 0.8, wallH),
      new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.30, side: THREE.DoubleSide }));
    wall.rotation.y = Math.PI / 2;
    wall.position.set(xOf(this.buffer), wallH / 2, 0);
    this.group.add(wall);
    var wallTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, DEPTH + 0.8),
      new THREE.MeshBasicMaterial({ color: RED }));
    wallTop.position.set(xOf(this.buffer), wallH, 0);
    this.group.add(wallTop);
    // grid markers at the real data points — no invented smoothness
    var dotGeo = new THREE.SphereGeometry(0.16, 8, 8);
    var dotMat = new THREE.MeshBasicMaterial({ color: 0x1c2434 });
    this.points.forEach(function (p) {
      var d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(xOf(p.x), ridgeY(p.y) + 0.04, 0);
      this.group.add(d);
    }.bind(this));
    this._frameCamera(this._peakY);
    this._render();
  };
  DelayTerrain.prototype._render = function () {
    if (this.mode === "3d" && this.renderer) this.renderer.render(this.scene, this.camera);
  };

  window.DelayTerrain = DelayTerrain;
})();
