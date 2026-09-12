'use strict';
/*
 * Smoke tests for the pure logic of app.js (run with: node test.js).
 * Covers geometry helpers and the flood-fill room detection that powers
 * the "room dimensions" feature.
 */
const assert = require('assert');
const { computeRooms, wallLength, distToSegment, snap } = require('./app.js');

function close(a, b, tol, msg) {
  assert(Math.abs(a - b) <= tol, `${msg || 'value'}: expected ${a} ≈ ${b} (±${tol})`);
}

// 1) A closed 4 m × 3 m rectangle yields one room with interior dimensions
//    (4 − 0.15 wall thickness) × (3 − 0.15).
const rect = [
  { id: 1, x1: 0, y1: 0, x2: 4, y2: 0 },
  { id: 2, x1: 4, y1: 0, x2: 4, y2: 3 },
  { id: 3, x1: 4, y1: 3, x2: 0, y2: 3 },
  { id: 4, x1: 0, y1: 3, x2: 0, y2: 0 },
];
{
  const { rooms } = computeRooms(rect, []);
  assert.strictEqual(rooms.length, 1, 'closed rectangle should give exactly one room');
  const r = rooms[0];
  close(r.width, 3.85, 0.08, 'room width');
  close(r.height, 2.85, 0.08, 'room height');
  close(r.area, 3.85 * 2.85, 0.6, 'room area');
}

// Two 4×3 rectangles side by side sharing divider wall id 2.
const two = [
  ...rect,
  { id: 5, x1: 4, y1: 0, x2: 8, y2: 0 },
  { id: 6, x1: 8, y1: 0, x2: 8, y2: 3 },
  { id: 7, x1: 8, y1: 3, x2: 4, y2: 3 },
];

// 2) A door in the shared wall connects the two spaces into one room.
{
  const doors = [{ id: 10, wallId: 2, pos: 0.5, width: 0.9, swing: 1 }];
  const { rooms } = computeRooms(two, doors);
  assert.strictEqual(rooms.length, 1, 'door should connect the two rooms into one');
  close(rooms[0].width, 7.85, 0.1, 'combined room width');
  close(rooms[0].height, 2.85, 0.1, 'combined room height');
}

// 3) Without a door the divider keeps them as two separate rooms
//    (a window would behave the same: windows stay closed for the fill).
{
  const { rooms } = computeRooms(two, []);
  assert.strictEqual(rooms.length, 2, 'divider wall should split into two rooms');
  close(rooms[0].width, 3.85, 0.08, 'left room width');
  close(rooms[1].width, 3.85, 0.08, 'right room width');
}

// 4) A gap in the boundary leaks to the exterior: no enclosed room.
{
  const open = rect.slice();
  open[1] = { id: 2, x1: 4, y1: 0, x2: 4, y2: 2 }; // 1 m gap at the bottom-right
  const { rooms } = computeRooms(open, []);
  assert.strictEqual(rooms.length, 0, 'a gap in the walls should produce no room');
}

// 5) Helper sanity checks.
close(wallLength({ x1: 0, y1: 0, x2: 3, y2: 4 }), 5, 1e-9, 'wallLength');
close(distToSegment(1, 1, 0, 0, 2, 0), 1, 1e-9, 'distToSegment');
close(snap(0.13, 0.25), 0.25, 1e-9, 'snap up');
close(snap(0.12, 0.25), 0, 1e-9, 'snap down');

console.log('All tests passed.');
