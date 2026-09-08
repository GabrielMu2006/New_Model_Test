/*!
 * geometry.js — pure geometry helpers for the floor-plan editor.
 *
 * Coordinate convention: world units are METERS and the Y axis points DOWN
 * (screen convention). With that convention, and the face-traversal rule used
 * in detectRooms(), interior room loops come out with a POSITIVE signed area.
 * No DOM access happens in this file, so it can be unit-tested under Node.
 */
(function (global) {
  'use strict';

  var EPS = 1e-9;

  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /** Closest point on segment a→b to p. Returns {t, x, y, dist}. */
  function projectOnSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    if (len2 <= EPS) return { t: 0, x: a.x, y: a.y, dist: dist(p, a) };
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    var tc = t < 0 ? 0 : t > 1 ? 1 : t;
    var x = a.x + dx * tc, y = a.y + dy * tc;
    return { t: tc, rawT: t, x: x, y: y, dist: Math.hypot(p.x - x, p.y - y) };
  }

  /** Shoelace. Positive = counter-clockwise in a Y-UP system, clockwise on screen. */
  function polygonSignedArea(poly) {
    var s = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  }

  function polygonArea(poly) {
    return Math.abs(polygonSignedArea(poly));
  }

  function polygonCentroid(poly) {
    var a = polygonSignedArea(poly), cx = 0, cy = 0;
    if (Math.abs(a) < EPS) {
      var sx = 0, sy = 0;
      for (var k = 0; k < poly.length; k++) { sx += poly[k].x; sy += poly[k].y; }
      return { x: sx / (poly.length || 1), y: sy / (poly.length || 1) };
    }
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var cross = p.x * q.y - q.x * p.y;
      cx += (p.x + q.x) * cross;
      cy += (p.y + q.y) * cross;
    }
    return { x: cx / (6 * a), y: cy / (6 * a) };
  }

  function polygonBounds(poly) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i];
      if (p.x < b.minX) b.minX = p.x;
      if (p.y < b.minY) b.minY = p.y;
      if (p.x > b.maxX) b.maxX = p.x;
      if (p.y > b.maxY) b.maxY = p.y;
    }
    b.width = b.maxX - b.minX;
    b.height = b.maxY - b.minY;
    return b;
  }

  /** The four corners of a wall drawn with a real thickness (centerline a→b). */
  function wallQuad(a, b, thickness) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var L = Math.hypot(dx, dy) || 1;
    var h = thickness / 2;
    var nx = (-dy / L) * h, ny = (dx / L) * h;
    return [
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny },
      { x: a.x - nx, y: a.y - ny }
    ];
  }

  /**
   * Detect closed rooms from a set of walls.
   *
   * Builds a planar graph (endpoints merged within `tol`), walks every
   * half-edge cycle choosing the next edge as the neighbour immediately
   * clockwise from the incoming edge, and keeps cycles with positive signed
   * area (interior faces in a Y-down system). Dangling walls produce
   * degenerate zero-area cycles and are dropped.
   *
   * @returns {Array<{polygon, area, width, height, centroid, bounds}>}
   */
  function detectRooms(walls, opts) {
    opts = opts || {};
    var tol = opts.tol || 1e-3;

    var nodes = [];
    var index = new Map();
    function nodeOf(x, y) {
      var kx = Math.round(x / tol), ky = Math.round(y / tol);
      var k = kx + ':' + ky;
      var id = index.get(k);
      if (id === undefined) {
        id = nodes.length;
        nodes.push({ x: kx * tol, y: ky * tol, adj: [] });
        index.set(k, id);
      }
      return id;
    }

    var seenEdge = new Set();
    var edges = [];
    function addEdge(u, v) {
      if (u === v) return;
      var ek = u < v ? u + '-' + v : v + '-' + u;
      if (seenEdge.has(ek)) return;
      seenEdge.add(ek);
      edges.push([u, v]);
    }

    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      addEdge(nodeOf(w.ax, w.ay), nodeOf(w.bx, w.by));
    }

    // Split every edge at any node lying on it (T-junctions), so that a wall
    // ending against the middle of another wall still closes a room.
    var rawEdges = edges.slice();
    edges = [];
    seenEdge.clear();
    for (var re = 0; re < rawEdges.length; re++) {
      var u2 = rawEdges[re][0], v2 = rawEdges[re][1];
      var A = nodes[u2], B = nodes[v2];
      var on = [];
      for (var k = 0; k < nodes.length; k++) {
        if (k === u2 || k === v2) continue;
        var pr = projectOnSegment(nodes[k], A, B);
        if (pr.dist <= tol && pr.rawT > 1e-6 && pr.rawT < 1 - 1e-6) {
          if (dist(nodes[k], A) > tol && dist(nodes[k], B) > tol) on.push({ t: pr.t, id: k });
        }
      }
      if (!on.length) { addEdge(u2, v2); continue; }
      on.sort(function (p, q) { return p.t - q.t; });
      var prev = u2;
      for (var oi = 0; oi < on.length; oi++) {
        addEdge(prev, on[oi].id);
        prev = on[oi].id;
      }
      addEdge(prev, v2);
    }

    // Adjacency lists, sorted by polar angle ascending.
    for (var e = 0; e < edges.length; e++) {
      var a = edges[e][0], b = edges[e][1];
      nodes[a].adj.push({ to: b, ang: Math.atan2(nodes[b].y - nodes[a].y, nodes[b].x - nodes[a].x) });
      nodes[b].adj.push({ to: a, ang: Math.atan2(nodes[a].y - nodes[b].y, nodes[a].x - nodes[b].x) });
    }
    for (var n = 0; n < nodes.length; n++) {
      nodes[n].adj.sort(function (p, q) { return p.ang - q.ang; });
      var pos = new Map();
      for (var j = 0; j < nodes[n].adj.length; j++) pos.set(nodes[n].adj[j].to, j);
      nodes[n].pos = pos;
    }

    var visited = new Set();
    var rooms = [];
    var maxSteps = edges.length * 4 + 16;

    for (var he = 0; he < edges.length; he++) {
      for (var d = 0; d < 2; d++) {
        var startU = edges[he][d], startV = edges[he][d === 0 ? 1 : 0];
        var startKey = startU + '>' + startV;
        if (visited.has(startKey)) continue;

        var poly = [];
        var cu = startU, cv = startV;
        var ok = true;
        for (var step = 0; step < maxSteps; step++) {
          visited.add(cu + '>' + cv);
          poly.push({ x: nodes[cu].x, y: nodes[cu].y });

          var adj = nodes[cv].adj;
          var idx = nodes[cv].pos.get(cu);
          if (idx === undefined || adj.length === 0) { ok = false; break; }

          // Next edge = neighbour just clockwise of the reverse direction.
          var next = adj[(idx - 1 + adj.length) % adj.length];
          cu = cv;
          cv = next.to;
          if (cu + '>' + cv === startKey) break;
        }
        if (!ok || poly.length < 3) continue;

        var signed = polygonSignedArea(poly);
        if (signed <= EPS) continue; // outer face or degenerate cycle

        var bounds = polygonBounds(poly);
        rooms.push({
          polygon: poly,
          area: signed,
          width: bounds.width,
          height: bounds.height,
          bounds: bounds,
          centroid: polygonCentroid(poly)
        });
      }
    }

    rooms.sort(function (p, q) { return q.area - p.area; });
    return rooms;
  }

  /** Corners of an object (rotated rect), used for bounds and hit-testing. */
  function objectCorners(o) {
    var c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    var hw = o.w / 2, hh = o.h / 2;
    var pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    return pts.map(function (p) {
      return { x: o.x + p[0] * c - p[1] * s, y: o.y + p[0] * s + p[1] * c };
    });
  }

  /** Point-in-object test in the object's local frame (ellipse for round items). */
  function pointInObject(p, o) {
    var c = Math.cos(-(o.rot || 0)), s = Math.sin(-(o.rot || 0));
    var dx = p.x - o.x, dy = p.y - o.y;
    var lx = dx * c - dy * s, ly = dx * s + dy * c;
    if (o.round) {
      var rx = o.w / 2 || 1, ry = o.h / 2 || 1;
      return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
    }
    return Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2;
  }

  function segIntersectsRect(a, b, r) {
    if (pointInRect(a, r) || pointInRect(b, r)) return true;
    var corners = [
      { x: r.minX, y: r.minY }, { x: r.maxX, y: r.minY },
      { x: r.maxX, y: r.maxY }, { x: r.minX, y: r.maxY }
    ];
    for (var i = 0; i < 4; i++) {
      if (segmentsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true;
    }
    return false;
  }

  function pointInRect(p, r) {
    return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
  }

  function segmentsIntersect(p1, p2, p3, p4) {
    function orient(a, b, c) {
      var v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      return v > EPS ? 1 : v < -EPS ? -1 : 0;
    }
    var o1 = orient(p1, p2, p3), o2 = orient(p1, p2, p4);
    var o3 = orient(p3, p4, p1), o4 = orient(p3, p4, p2);
    return o1 !== o2 && o3 !== o4;
  }

  var api = {
    dist: dist,
    projectOnSegment: projectOnSegment,
    polygonSignedArea: polygonSignedArea,
    polygonArea: polygonArea,
    polygonCentroid: polygonCentroid,
    polygonBounds: polygonBounds,
    wallQuad: wallQuad,
    detectRooms: detectRooms,
    objectCorners: objectCorners,
    pointInObject: pointInObject,
    pointInRect: pointInRect,
    segIntersectsRect: segIntersectsRect,
    segmentsIntersect: segmentsIntersect
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.FloorPlanGeom = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
