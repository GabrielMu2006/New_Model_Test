const G = require('./geometry.js');
let fails = 0;
const ok = (name, cond, extra='') => { if(!cond){ fails++; console.log('FAIL', name, extra);} else console.log('pass', name); };

// 1. single square room
let walls = [
  {ax:0,ay:0,bx:8,by:0},{ax:8,ay:0,bx:8,by:6},{ax:8,ay:6,bx:0,by:6},{ax:0,ay:6,bx:0,by:0}
];
let rooms = G.detectRooms(walls);
ok('square: one room', rooms.length===1, JSON.stringify(rooms.map(r=>r.area)));
ok('square: area 48', Math.abs(rooms[0].area-48)<1e-9, rooms[0].area);
ok('square: dims 8x6', Math.abs(rooms[0].width-8)<1e-9 && Math.abs(rooms[0].height-6)<1e-9);
ok('square: centroid 4,3', Math.abs(rooms[0].centroid.x-4)<1e-9 && Math.abs(rooms[0].centroid.y-3)<1e-9);

// 2. two rooms sharing a wall
walls = [
  {ax:0,ay:0,bx:8,by:0},{ax:8,ay:0,bx:8,by:6},{ax:8,ay:6,bx:0,by:6},{ax:0,ay:6,bx:0,by:0},
  {ax:5,ay:0,bx:5,by:6}
];
rooms = G.detectRooms(walls);
ok('two rooms', rooms.length===2, JSON.stringify(rooms.map(r=>r.area)));
ok('two rooms areas 30/18', Math.abs(rooms[0].area-30)<1e-9 && Math.abs(rooms[1].area-18)<1e-9);

// 3. three rooms (split one side)
walls = [
  {ax:0,ay:0,bx:8,by:0},{ax:8,ay:0,bx:8,by:6},{ax:8,ay:6,bx:0,by:6},{ax:0,ay:6,bx:0,by:0},
  {ax:5,ay:0,bx:5,by:6},{ax:5,ay:3.2,bx:8,by:3.2}
];
rooms = G.detectRooms(walls);
ok('three rooms', rooms.length===3, JSON.stringify(rooms.map(r=>[r.area,r.width,r.height])));
ok('three rooms areas', Math.abs(rooms[0].area-30)<1e-9 && Math.abs(rooms[1].area-9.6)<1e-9 && Math.abs(rooms[2].area-8.4)<1e-9);

// 4. dangling wall does not create a room
walls = [{ax:0,ay:0,bx:4,by:0},{ax:4,ay:0,bx:4,by:4},{ax:4,ay:4,bx:0,by:4},{ax:0,ay:4,bx:0,by:0},{ax:4,ay:2,bx:7,by:2}];
rooms = G.detectRooms(walls);
ok('dangling ignored', rooms.length===1 && Math.abs(rooms[0].area-16)<1e-9, JSON.stringify(rooms.map(r=>r.area)));

// 5. endpoint merging tolerance (1mm gap)
walls = [{ax:0,ay:0,bx:4,by:0},{ax:4.0004,ay:0,bx:4,by:4},{ax:4,ay:4,bx:0,by:4},{ax:0,ay:4,bx:0,by:0}];
rooms = G.detectRooms(walls);
ok('merge 0.4mm gap', rooms.length===1, JSON.stringify(rooms.map(r=>r.area)));

// 6. rotated (non-axis-aligned) triangle room
walls = [{ax:0,ay:0,bx:4,by:0},{ax:4,ay:0,bx:0,by:3},{ax:0,by:3,ay:3,bx:0,by:0}];
rooms = G.detectRooms(walls);
ok('triangle area 6', rooms.length===1 && Math.abs(rooms[0].area-6)<1e-9, JSON.stringify(rooms.map(r=>r.area)));

// 7. helpers
ok('projectOnSegment mid', (()=>{const r=G.projectOnSegment({x:5,y:3},{x:0,y:0},{x:10,y:0});return Math.abs(r.t-0.5)<1e-9 && Math.abs(r.dist-3)<1e-9;})());
ok('projectOnSegment clamp', (()=>{const r=G.projectOnSegment({x:-5,y:0},{x:0,y:0},{x:10,y:0});return r.t===0 && Math.abs(r.dist-5)<1e-9;})());
ok('wallQuad thickness', (()=>{const q=G.wallQuad({x:0,y:0},{x:10,y:0},1);return Math.abs(q[0].y-0.5)<1e-9 && Math.abs(q[3].y+0.5)<1e-9;})());
ok('pointInObject rot90 in', G.pointInObject({x:0.4,y:0},{x:0,y:0,w:2,h:1,rot:Math.PI/2}));
ok('pointInObject rot90 in2', G.pointInObject({x:0,y:0.9},{x:0,y:0,w:2,h:1,rot:Math.PI/2}));
ok('pointInObject rot90 out', !G.pointInObject({x:1.4,y:0.1},{x:0,y:0,w:2,h:1,rot:Math.PI/2}));
ok('pointInObject miss', !G.pointInObject({x:1.4,y:0.1},{x:0,y:0,w:2,h:1,rot:0}));
ok('pointInObject round', G.pointInObject({x:0.4,y:0},{x:0,y:0,w:1,h:1,rot:0,round:true}));
ok('segIntersectsRect', G.segIntersectsRect({x:-2,y:0.5},{x:2,y:0.5},{minX:0,minY:0,maxX:1,maxY:1}));
ok('segIntersectsRect miss', !G.segIntersectsRect({x:-2,y:5},{x:2,y:5},{minX:0,minY:0,maxX:1,maxY:1}));
console.log(fails? `\n${fails} FAILURES` : '\nALL GEOMETRY TESTS PASSED');
process.exit(fails?1:0);
