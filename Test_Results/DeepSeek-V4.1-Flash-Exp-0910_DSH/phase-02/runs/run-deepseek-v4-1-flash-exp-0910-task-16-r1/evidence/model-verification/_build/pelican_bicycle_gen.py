#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pelican_bicycle_gen.py  ->  pelican-bicycle.svg

Builds a single self-contained animated SVG (SMIL only, no external assets).

Motion is physically consistent inside one master loop T = 2.0 s:

  * T  = exactly one crank revolution (crank = 1 turn / loop)
  * chainring r=24, cog r=12  ->  gear ratio 2.0
      => each wheel turns exactly 2 x per crank turn
  * ground scroll per loop = 2 * 2*pi*R_wheel = 753.98 px
      => the road moves exactly as fast as the tyre contact point (no slip)
  * parallax layers shift the same distance over longer, independent loops
  * the leg is a 2-bone IK chain solved every 4 degrees; the ankle lands on
    the pedal spindle at every instant, so the feet never leave the pedals
"""

import math

# --------------------------------------------------------------------------
# 1. constants
# --------------------------------------------------------------------------
W, H = 960.0, 540.0
LOOP = 2.0                                   # seconds, one crank revolution
N = 90                                       # keyframes per loop (4 deg step)
NB = 24                                      # keyframes for slow "body" curves

# bicycle
REAR_HUB = (392.0, 372.0)
FRONT_HUB = (588.0, 372.0)
WHEEL_R = 60.0
BB = (478.0, 386.0)                          # bottom bracket / crank centre
CRANK_R = 30.0
CHAINRING_R = 24.0
COG_R = 12.0

# frame nodes
SEAT_TOP = (450.0, 272.0)
SADDLE = (444.0, 260.0)
HEAD_TOP = (555.0, 300.0)
CROWN = (570.0, 344.0)
BAR = (566.0, 288.0)

# rider
HIP = (430.0, 252.0)                         # hip joint (inside the body)
THIGH = 76.0
SHIN = 104.0
ANKLE_OFF = (-2.0, -12.0)                    # ankle relative to pedal spindle
FOOT_TILT = 6.0                              # deg, ankle roll over the pedal

# body response to pedalling
BOB_Y = 3.4
BOB_X = 1.2
ROLL = 1.15
NECK_NOD = 1.7
WING_FLAP = 1.5

SHIFT = 2.0 * 2.0 * math.pi * WHEEL_R        # px the ground travels per loop
PERIOD = SHIFT                               # every scrolling tile period

# colours
C_SKY_TOP, C_SKY_BOT = "#8fc9e8", "#eaf7fc"
C_HILL_BACK, C_HILL_FRONT = "#c3dfe2", "#a8ced2"
C_TREE, C_TREE_DK, C_TRUNK = "#7fb491", "#639a77", "#6b5a4b"
C_GRASS, C_GRASS_DK = "#9ccf8e", "#7cb673"
C_ROAD_TOP, C_ROAD_BOT = "#767b84", "#565b64"
C_TIRE, C_RIM, C_HUB = "#2f3640", "#dbe2e7", "#b6c0c7"
C_FRAME, C_FRAME_DK = "#2e7d8f", "#1f5f6e"
C_SADDLE = "#4a3b34"
C_CHAIN = "#9aa3ab"
C_BODY, C_BODY_SH, C_BODY_LN = "#ffffff", "#e7eef3", "#c2d0d9"
C_WING_TIP = "#46505c"
C_BEAK, C_POUCH = "#f0a23c", "#f7c98b"
C_LEG, C_FOOT = "#e8964f", "#dd8440"
C_LEG_FAR, C_FOOT_FAR = "#c97b3c", "#b96f31"
C_EYE = "#22303a"
C_SCARF = "#e2554e"

# webbed foot, local origin = ankle, toes towards +x, sole at about y=+7
FOOT_PATH = ("M-11.5 -7C-4.6 -11.5 9.2 -11.5 19.6 -7C28.8 -2.3 33.4 1.2 31 4.6"
             "C28.8 8 19.6 9.2 15 5.8C13.8 10.4 6.9 11.5 2.3 8.1"
             "C-3.5 10.4 -10.4 8.1 -12.7 3.5C-13.8 0 -12.7 -4.6 -11.5 -7Z")


# --------------------------------------------------------------------------
# 2. small helpers
# --------------------------------------------------------------------------
def n2(v):
    """compact number formatting"""
    s = "%.2f" % v
    if s.endswith("00"):
        s = s[:-3]
    elif s.endswith("0"):
        s = s[:-1]
    return "0" if s in ("-0", "") else s


def pt(p):
    return "%s %s" % (n2(p[0]), n2(p[1]))


def kf(values):
    return ";".join(values)


def rot_anim(angles, pivot, dur=LOOP, extra=""):
    """animateTransform rotate with a constant pivot"""
    vals = kf("%s %s %s" % (n2(a), n2(pivot[0]), n2(pivot[1])) for a in angles)
    return ('<animateTransform attributeName="transform" type="rotate" '
            'calcMode="linear" values="%s" dur="%ss" repeatCount="indefinite"%s/>'
            % (vals, n2(dur), extra))


def d_anim(values, dur=LOOP):
    """animate the path data (same command structure in every keyframe)"""
    return ('<animate attributeName="d" calcMode="linear" values="%s" dur="%ss" '
            'repeatCount="indefinite"/>' % (kf(values), n2(dur)))


def trans_anim(points, dur=LOOP, extra=""):
    """animateTransform translate"""
    vals = kf(pt(p) for p in points)
    return ('<animateTransform attributeName="transform" type="translate" '
            'calcMode="linear" values="%s" dur="%ss" repeatCount="indefinite"%s/>'
            % (vals, n2(dur), extra))


# --------------------------------------------------------------------------
# 3. kinematics
# --------------------------------------------------------------------------
def pedal_pos(theta):
    return (BB[0] + CRANK_R * math.cos(theta), BB[1] + CRANK_R * math.sin(theta))


def leg_ik(hip, ankle, l1, l2):
    """2-bone IK; knee is pushed towards +x (forward) so it bends like a rider."""
    dx, dy = ankle[0] - hip[0], ankle[1] - hip[1]
    d = math.hypot(dx, dy)
    dmax, dmin = l1 + l2 - 0.001, abs(l1 - l2) + 0.001
    d = min(max(d, dmin), dmax)
    ux, uy = dx / math.hypot(dx, dy), dy / math.hypot(dx, dy)
    a = (d * d + l1 * l1 - l2 * l2) / (2.0 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    px, py = uy, -ux                       # forward normal for a downward leg
    return (hip[0] + a * ux + h * px, hip[1] + a * uy + h * py)


def body_state(theta):
    """subtle body response: rises on each power stroke (2 per revolution)"""
    by = -BOB_Y * math.sin(2.0 * theta)
    bx = -BOB_X * math.cos(2.0 * theta + math.radians(25.0))
    roll = ROLL * math.sin(2.0 * theta + math.radians(55.0))
    return bx, by, roll


def leg_keyframes(phase):
    """returns thigh d-values, shin d-values, ankle points, foot tilts"""
    thighs, shins, ankles, tilts = [], [], [], []
    for i in range(N + 1):
        th = 2.0 * math.pi * i / N
        bx, by, _ = body_state(th)
        hip = (HIP[0] + bx, HIP[1] + by)
        p = pedal_pos(th + phase)
        ankle = (p[0] + ANKLE_OFF[0], p[1] + ANKLE_OFF[1])
        knee = leg_ik(hip, ankle, THIGH, SHIN)
        thighs.append("M%sL%s" % (pt(hip), pt(knee)))
        shins.append("M%sL%s" % (pt(knee), pt(ankle)))
        ankles.append(ankle)
        tilts.append(FOOT_TILT * math.sin(th + phase))
    return thighs, shins, ankles, tilts


# --------------------------------------------------------------------------
# 4. background tiles (period = PERIOD, seamless because every element is
#    generated from periodic functions of x / PERIOD)
# --------------------------------------------------------------------------
def hill_path(base, amps, phase, samples=110, drop=60.0):
    pts = []
    for i in range(samples + 1):
        x = PERIOD * i / samples
        y = base
        for h, a, p in amps:
            y -= a * (0.5 + 0.5 * math.sin(2 * math.pi * h * x / PERIOD + p + phase))
        pts.append((x, y))
    d = "M%s" % pt(pts[0])
    for x, y in pts[1:]:
        d += "L%s" % pt((x, y))
    d += "L%sL%sZ" % (pt((PERIOD, base + drop)), pt((0, base + drop)))
    return d


def cloud(cx, cy, s, op=0.9):
    return ('<g opacity="%s" fill="#ffffff"><ellipse cx="%s" cy="%s" rx="%s" ry="%s"/>'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s"/>'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s"/></g>'
            % (op, n2(cx), n2(cy), n2(34 * s), n2(15 * s),
               n2(cx + 26 * s), n2(cy + 5 * s), n2(24 * s), n2(11 * s),
               n2(cx - 27 * s), n2(cy + 6 * s), n2(21 * s), n2(10 * s)))


def tree(cx, base, s, dark=False):
    col = C_TREE_DK if dark else C_TREE
    return ('<g><rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/></g>'
            % (n2(cx - 2.6 * s), n2(base - 22 * s), n2(5.2 * s), n2(24 * s), n2(2.4 * s), C_TRUNK,
               n2(cx), n2(base - 40 * s), n2(24 * s), n2(21 * s), col,
               n2(cx - 9 * s), n2(base - 27 * s), n2(16 * s), n2(13 * s), col))


def bush(cx, base, s):
    return ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>'
            % (n2(cx), n2(base - 7 * s), n2(17 * s), n2(11 * s), C_TREE_DK,
               n2(cx + 9 * s), n2(base - 5 * s), n2(11 * s), n2(8 * s), C_TREE))


def tuft(cx, base, s, col=C_GRASS_DK):
    d = ("M%sL%sL%sL%sL%sL%sL%sZ"
         % (pt((cx - 5 * s, base)), pt((cx - 3.4 * s, base - 12 * s)),
            pt((cx - 1.4 * s, base - 3 * s)), pt((cx, base - 16 * s)),
            pt((cx + 1.6 * s, base - 3 * s)), pt((cx + 3.4 * s, base - 11 * s)),
            pt((cx + 5 * s, base))))
    return '<path d="%s" fill="%s"/>' % (d, col)


def pebble(cx, cy, rx, ry, col="#5b606a"):
    return '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (
        n2(cx), n2(cy), n2(rx), n2(ry), col)


# --------------------------------------------------------------------------
# 5. build the pieces
# --------------------------------------------------------------------------
out = []
A = out.append

A('<?xml version="1.0" encoding="UTF-8"?>')
A('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
  'id="pelican-svg" width="960" height="540" viewBox="0 0 960 540" '
  'role="img" aria-labelledby="svg-title svg-desc">')
A('<title id="svg-title">Pelican riding a bicycle</title>')
A('<desc id="svg-desc">A pelican pedals a bicycle from left to right. The wheels and the '
  'crank turn, the feet stay on the pedals, the body bobs with the pedalling, the '
  'background scrolls past in parallax, and a button pauses or resumes the animation.</desc>')

# ---------------------------------------------------------------- defs
A('<defs>')
A('<linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">'
  '<stop offset="0" stop-color="%s"/><stop offset="0.72" stop-color="#cfeaf6"/>'
  '<stop offset="1" stop-color="%s"/></linearGradient>' % (C_SKY_TOP, C_SKY_BOT))
A('<radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">'
  '<stop offset="0" stop-color="#fff3c9" stop-opacity="0.95"/>'
  '<stop offset="0.55" stop-color="#ffe9a8" stop-opacity="0.42"/>'
  '<stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>')
A('<radialGradient id="groundShadow" cx="0.5" cy="0.5" r="0.5">'
  '<stop offset="0" stop-color="#1b2b33" stop-opacity="0.30"/>'
  '<stop offset="0.6" stop-color="#1b2b33" stop-opacity="0.14"/>'
  '<stop offset="1" stop-color="#1b2b33" stop-opacity="0"/></radialGradient>')
A('<linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">'
  '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>'
  % (C_ROAD_TOP, C_ROAD_BOT))
A('<linearGradient id="bodyGrad" x1="0.15" y1="0" x2="0.7" y2="1">'
  '<stop offset="0" stop-color="#ffffff"/><stop offset="0.62" stop-color="#f4f8fa"/>'
  '<stop offset="1" stop-color="%s"/></linearGradient>' % C_BODY_SH)
A('<clipPath id="sceneClip"><rect x="0" y="0" width="960" height="540"/></clipPath>')

# --- reusable wheel spokes ------------------------------------------------
sp = []
for k in range(12):
    a = math.radians(k * 30.0)
    sp.append('<line x1="%s" y1="%s" x2="%s" y2="%s"/>' % (
        n2(4.5 * math.cos(a)), n2(4.5 * math.sin(a)),
        n2(52 * math.cos(a)), n2(52 * math.sin(a))))
A('<g id="spokes" stroke="%s" stroke-width="1.7" stroke-linecap="round">%s'
  '<rect x="45" y="-2.4" width="7" height="4.8" rx="2" fill="%s" stroke="none"/></g>'
  % (C_RIM, "".join(sp), C_RIM))

# --- background tiles ------------------------------------------------------
# clouds (slowest)
cl = []
for cx, cy, s in ((60, 96, 1.15), (250, 150, 0.85), (430, 82, 1.0),
                  (600, 132, 0.72), (700, 62, 0.9)):
    cl.append(cloud(cx, cy, s))
A('<g id="tileClouds">%s</g>' % "".join(cl))

# far hills
A('<g id="tileHills">'
  '<path d="%s" fill="%s"/>'
  '<path d="%s" fill="%s"/></g>'
  % (hill_path(404.0, ((1, 46.0, 0.0), (2, 21.0, 1.5), (3, 11.0, 3.0), (5, 5.0, 0.8)), 0.0),
     C_HILL_BACK,
     hill_path(410.0, ((1, 27.0, 2.1), (2, 15.0, 0.2), (4, 7.0, 1.7), (7, 3.5, 2.6)), 1.2),
     C_HILL_FRONT))

# mid layer: trees, bushes, fence
md = []
for cx, s, dark in ((70, 1.05, False), (196, 0.8, True), (330, 1.25, False),
                    (470, 0.9, True), (596, 1.1, False), (708, 0.78, True)):
    md.append(tree(cx, 404.0, s, dark))
for cx, s in ((130, 1.0), (268, 0.8), (410, 1.1), (520, 0.85), (650, 1.0), (740, 0.8)):
    md.append(bush(cx, 406.0, s))
# a fence along the roadside
fence = []
for i in range(19):
    x = 6 + i * 41.0
    fence.append('<rect x="%s" y="%s" width="4" height="26" rx="1.6" fill="#b9a68f"/>'
                 % (n2(x), n2(384.0)))
fence.append('<rect x="0" y="%s" width="%s" height="4" rx="2" fill="#c9b7a0"/>'
             % (n2(388.0), n2(PERIOD)))
fence.append('<rect x="0" y="%s" width="%s" height="4" rx="2" fill="#c9b7a0"/>'
             % (n2(398.0), n2(PERIOD)))
md.append("".join(fence))
A('<g id="tileMid">%s</g>' % "".join(md))

# ground layer: lane dashes, asphalt patches, pebbles, verge tufts
gd = []
for i in range(6):
    x = i * (PERIOD / 6.0) + 22.0
    gd.append('<rect x="%s" y="476" width="74" height="7" rx="3.5" fill="#f2f0e6" '
              'opacity="0.85"/>' % n2(x))
for cx, cy, rx, ry in ((40, 508, 40, 6), (250, 522, 52, 7), (430, 500, 34, 5),
                       (600, 528, 58, 8), (700, 502, 30, 4.5)):
    gd.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#4a4f58" '
              'opacity="0.45"/>' % (n2(cx), n2(cy), n2(rx), n2(ry)))
for cx, cy, rx, ry in ((120, 448, 5, 3), (300, 462, 4, 2.6), (520, 442, 5.5, 3.2),
                       (660, 470, 4.5, 2.8), (740, 452, 4, 2.4)):
    gd.append(pebble(cx, cy, rx, ry, "#828892"))
for cx, s in ((30, 1.0), (150, 0.8), (250, 1.15), (390, 0.9), (500, 1.05),
              (610, 0.85), (700, 1.1)):
    gd.append(tuft(cx, 420.0, s))
    gd.append(tuft(cx + 11 * s, 420.0, s * 0.7, C_GRASS))
A('<g id="tileGround">%s</g>' % "".join(gd))
A('</defs>')

# ---------------------------------------------------------------- scene
A('<g clip-path="url(#sceneClip)">')

# sky + sun
A('<rect width="960" height="540" fill="url(#skyGrad)"/>')
A('<circle cx="778" cy="112" r="120" fill="url(#sunGlow)"/>')
A('<circle cx="778" cy="112" r="40" fill="#fff6d4"/>')

# scrolling layers, back to front.  Each layer is one animated group holding
# enough copies of its tile (period = PERIOD) to cover the viewport while it
# slides exactly one tile to the left, so the loop is seamless.
A('<g>%s%s</g>' % (
    trans_anim([(0, 0), (-PERIOD, 0)], 40.0),
    "".join('<use xlink:href="#tileClouds" href="#tileClouds" x="%s"/>' % n2(k * PERIOD)
            for k in (-1, 0, 1, 2))))

A('<g>%s%s</g>' % (
    trans_anim([(0, 0), (-PERIOD, 0)], 20.0),
    "".join('<use xlink:href="#tileHills" href="#tileHills" x="%s"/>' % n2(k * PERIOD)
            for k in (-1, 0, 1, 2))))

A('<g>%s%s</g>' % (
    trans_anim([(0, 0), (-PERIOD, 0)], 6.25),
    "".join('<use xlink:href="#tileMid" href="#tileMid" x="%s"/>' % n2(k * PERIOD)
            for k in (-1, 0, 1, 2))))

# verge + road (static bands)
A('<rect x="0" y="398" width="960" height="26" fill="%s"/>' % C_GRASS)
A('<rect x="0" y="398" width="960" height="4" fill="#b7e0a8" opacity="0.75"/>')
A('<rect x="0" y="418" width="960" height="122" fill="url(#roadGrad)"/>')
A('<rect x="0" y="418" width="960" height="3" fill="#8b9099" opacity="0.8"/>')
A('<rect x="0" y="428" width="960" height="3" fill="#f2f0e6" opacity="0.55"/>')

A('<g>%s%s</g>' % (
    trans_anim([(0, 0), (-PERIOD, 0)], LOOP),
    "".join('<use xlink:href="#tileGround" href="#tileGround" x="%s"/>' % n2(k * PERIOD)
            for k in (-1, 0, 1, 2))))

# contact shadow
A('<ellipse cx="490" cy="434" rx="168" ry="13" fill="url(#groundShadow)"/>')

# ---------------------------------------------------------------- bicycle
# wheels (spokes rotate, tyre + rim are rotationally symmetric)
for hub, name in ((REAR_HUB, "rear"), (FRONT_HUB, "front")):
    A('<g transform="translate(%s)">' % pt(hub))
    A('<g>%s<use xlink:href="#spokes" href="#spokes"/></g>'
      % rot_anim([0.0, 720.0], (0.0, 0.0)))
    A('<circle r="%s" fill="none" stroke="%s" stroke-width="9"/>' % (n2(WHEEL_R), C_TIRE))
    A('<circle r="52" fill="none" stroke="%s" stroke-width="3.6"/>' % C_RIM)
    A('<circle r="7.5" fill="%s"/><circle r="3" fill="#8b959d"/>' % C_HUB)
    A('</g>')

# ---- far side drivetrain + far leg (drawn behind the frame)
thighs_f, shins_f, ankles_f, tilts_f = leg_keyframes(math.pi)
pedals_f = [pedal_pos(2.0 * math.pi * i / N + math.pi) for i in range(N + 1)]
A('<g>%s<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="7" '
  'stroke-linecap="round"/></g>'
  % (rot_anim([180.0, 540.0], BB), n2(BB[0]), n2(BB[1]),
     n2(BB[0] + CRANK_R), n2(BB[1]), C_FRAME_DK))
A('<g>%s<rect x="%s" y="%s" width="34" height="12" rx="5" fill="#3f4750"/></g>'
  % (trans_anim(pedals_f), n2(BB[0] + CRANK_R - 17), n2(BB[1] - 6)))
A('<g><path d="%s" stroke="%s" stroke-width="16" stroke-linecap="round" fill="none">'
  '%s</path>'
  '<path d="%s" stroke="%s" stroke-width="11.5" stroke-linecap="round" fill="none">'
  '%s</path></g>'
  % (thighs_f[0], C_LEG_FAR, d_anim(thighs_f), shins_f[0], C_LEG_FAR, d_anim(shins_f)))
A('<g>%s<g>%s<path d="%s" fill="%s"/></g></g>'
  % (trans_anim(ankles_f), rot_anim(tilts_f, (0.0, 0.0)), FOOT_PATH, C_FOOT_FAR))

# ---- frame
A('<g stroke="%s" stroke-width="8" stroke-linecap="round" fill="none">' % C_FRAME)
A('<path d="M%sL%s"/>' % (pt(BB), pt(SEAT_TOP)))                    # seat tube
A('<path d="M%sL%s"/>' % (pt(BB), pt((573.0, 340.0))))              # down tube
A('<path d="M%sL%s"/>' % (pt(SEAT_TOP), pt(HEAD_TOP)))              # top tube
A('<path d="M%sL%s"/>' % (pt(BB), pt(REAR_HUB)))                   # chain stays
A('<path d="M%sL%s"/>' % (pt((452.0, 276.0)), pt(REAR_HUB)))        # seat stays
A('<path d="M%sL%s"/>' % (pt((446.0, 266.0)), pt((443.0, 258.0))))  # seat post
A('<path d="M%sL%s" stroke-width="11"/>' % (pt(HEAD_TOP), pt(CROWN)))  # head tube
A('<path d="M%sL%s"/>' % (pt(CROWN), pt(FRONT_HUB)))                # fork
A('<path d="M%sL%s" stroke-width="7"/>' % (pt((556.0, 298.0)), pt(BAR)))   # stem
A('<path d="M%sC%s %s %s" stroke-width="7"/>' % (                     # bar + grips
    pt(BAR), pt((572.0, 282.0)), pt((556.0, 278.0)), pt((536.0, 284.0))))
A('</g>')
A('<circle cx="%s" cy="%s" r="5" fill="%s"/>' % (n2(BAR[0]), n2(BAR[1]), C_FRAME_DK))
A('<rect x="%s" y="%s" width="12" height="12" rx="5" fill="%s"/>'
  % (n2(530.0), n2(278.0), "#37414c"))

# ---- chain (closed path, links crawl along it)
c1, r1, c2, r2 = BB, CHAINRING_R, REAR_HUB, COG_R
dx, dy = c2[0] - c1[0], c2[1] - c1[1]
dc = math.hypot(dx, dy)
vx, vy = dx / dc, dy / dc
phi = math.acos((r1 - r2) / dc)


def _rot(x, y, a):
    return (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a))


nt = _rot(vx, vy, phi)
nb = _rot(vx, vy, -phi)
T1 = (c1[0] + r1 * nt[0], c1[1] + r1 * nt[1])
B1 = (c1[0] + r1 * nb[0], c1[1] + r1 * nb[1])
T2 = (c2[0] + r2 * nt[0], c2[1] + r2 * nt[1])
B2 = (c2[0] + r2 * nb[0], c2[1] + r2 * nb[1])
chain_len = (math.hypot(T1[0] - T2[0], T1[1] - T2[1]) + math.pi * r1 +
             math.hypot(B1[0] - B2[0], B1[1] - B2[1]) + math.pi * r2)
LINKS = 23
link = chain_len / LINKS
chain_speed = 2.0 * math.pi / LOOP * CHAINRING_R      # px/s
chain_adv = chain_speed * LOOP                         # px per loop
K = max(1, round(chain_adv / link))
dash_period = chain_adv / K
A('<path d="M%sL%sA%s %s 0 0 1 %sL%sA%s %s 0 0 1 %sZ" fill="none" stroke="%s" '
  'stroke-width="3.2" stroke-dasharray="%s %s">'
  '<animate attributeName="stroke-dashoffset" values="0;%s" calcMode="linear" '
  'dur="%ss" repeatCount="indefinite"/></path>'
  % (pt(T2), pt(T1), n2(r1), n2(r1), pt(B1), pt(B2), n2(r2), n2(r2), pt(T2),
     C_CHAIN, n2(dash_period * 0.58), n2(dash_period * 0.42), n2(-chain_adv), n2(LOOP)))

# saddle (behind the near leg, in front of the far leg, under the bird)
A('<path d="M%sC%s %s %sC%s %s %sC%s %s %sZ" fill="%s"/>'
  % (pt((414.0, 264.0)), pt((422.0, 252.0)), pt((440.0, 246.0)), pt((458.0, 246.0)),
     pt((472.0, 247.0)), pt((476.0, 254.0)), pt((470.0, 259.0)),
     pt((456.0, 266.0)), pt((426.0, 268.0)), pt((414.0, 264.0)), C_SADDLE))
A('<path d="M%sC%s %s %s" stroke="#6a5548" stroke-width="2" fill="none"/>'
  % (pt((424.0, 254.0)), pt((438.0, 250.0)), pt((456.0, 250.0)), pt((468.0, 253.0))))

# ---- chainring + near crank + near pedal + near leg
A('<g>%s<circle r="%s" fill="none" stroke="#c8d1d8" stroke-width="7" '
  'stroke-dasharray="3.1 4.44"/><circle r="17" fill="none" stroke="%s" '
  'stroke-width="3"/></g>'
  % (rot_anim([0.0, 360.0], BB), n2(CHAINRING_R), "#aeb9c1"))
A('<circle cx="%s" cy="%s" r="9" fill="%s"/>' % (n2(BB[0]), n2(BB[1]), C_FRAME_DK))
A('<g>%s<circle r="%s" fill="none" stroke="#c8d1d8" stroke-width="6" '
  'stroke-dasharray="2.5 3.78"/></g>' % (rot_anim([0.0, 720.0], REAR_HUB), n2(COG_R)))

thighs_n, shins_n, ankles_n, tilts_n = leg_keyframes(0.0)
pedals_n = [pedal_pos(2.0 * math.pi * i / N) for i in range(N + 1)]
A('<g>%s<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="7" '
  'stroke-linecap="round"/></g>'
  % (rot_anim([0.0, 360.0], BB), n2(BB[0]), n2(BB[1]),
     n2(BB[0] + CRANK_R), n2(BB[1]), C_FRAME_DK))
A('<g>%s<rect x="%s" y="%s" width="34" height="12" rx="5" fill="#39424b"/></g>'
  % (trans_anim(pedals_n), n2(BB[0] + CRANK_R - 17), n2(BB[1] - 6)))
A('<g><path d="%s" stroke="%s" stroke-width="16" stroke-linecap="round" fill="none">'
  '%s</path>'
  '<path d="%s" stroke="%s" stroke-width="11.5" stroke-linecap="round" fill="none">'
  '%s</path></g>'
  % (thighs_n[0], C_LEG, d_anim(thighs_n), shins_n[0], C_LEG, d_anim(shins_n)))
A('<g>%s<g>%s<path d="%s" fill="%s"/></g></g>'
  % (trans_anim(ankles_n), rot_anim(tilts_n, (0.0, 0.0)), FOOT_PATH, C_FOOT))


# ---------------------------------------------------------------- pelican
bob_pts = []
roll_vals = []
nod_vals = []
wing_vals = []
for i in range(NB + 1):
    th = 2.0 * math.pi * i / NB
    bx, by, roll = body_state(th)
    bob_pts.append((bx, by))
    roll_vals.append(roll)
    # neck / head lag behind the body
    nod_vals.append(-NECK_NOD * math.sin(2.0 * th - math.radians(45.0)))
    wing_vals.append(WING_FLAP * math.sin(2.0 * th + math.radians(110.0)))

A('<g>%s<g>%s' % (trans_anim(bob_pts), rot_anim(roll_vals, HIP)))

# tail feathers
A('<path d="M%sC%s %s %s %sC%s %s %sZ" fill="%s"/>'
  % (pt((344.0, 240.0)), pt((326.0, 232.0)), pt((300.0, 226.0)), pt((280.0, 228.0)),
     pt((276.0, 234.0)), pt((296.0, 244.0)), pt((322.0, 250.0)), pt((344.0, 240.0)),
     C_BODY_SH))
A('<path d="M%sC%s %s %sZ" fill="%s"/>'
  % (pt((344.0, 246.0)), pt((312.0, 250.0)), pt((288.0, 246.0)), pt((300.0, 238.0)),
     C_WING_TIP))

# body
A('<path d="M336 224C318 210 320 186 340 172C362 156 392 146 420 148'
  'C452 150 478 168 486 194C494 222 486 244 466 254C444 266 408 268 384 260'
  'C360 252 344 238 336 224Z" fill="url(#bodyGrad)" stroke="%s" stroke-width="2"/>'
  % C_BODY_LN)
# breast / belly shading
A('<path d="M452 250C470 240 482 220 480 200C492 224 488 246 466 256'
  'C450 263 434 265 420 263C432 260 444 256 452 250Z" fill="%s" opacity="0.85"/>'
  % C_BODY_SH)

# wing (folded, tip dark) — the group gives a faint flutter with the pedalling
A('<g>%s'
  '<path d="M%sC%s %s %sC%s %s %sZ" fill="%s" stroke="%s" stroke-width="1.6"/>'
  '<path d="M%sC%s %s %sC%s %s %sZ" fill="%s"/>'
  '<path d="M%sC%s %s %s" stroke="%s" stroke-width="1.5" fill="none" opacity="0.6"/>'
  '<path d="M%sC%s %s %s" stroke="%s" stroke-width="1.5" fill="none" opacity="0.5"/>'
  '</g>'
  % (rot_anim(wing_vals, (438.0, 196.0)),
     pt((452.0, 186.0)), pt((404.0, 166.0)), pt((348.0, 190.0)), pt((322.0, 226.0)),
     pt((332.0, 246.0)), pt((400.0, 248.0)), pt((452.0, 186.0)),
     "#eef4f7", C_BODY_LN,
     pt((322.0, 226.0)), pt((330.0, 243.0)), pt((342.0, 250.0)), pt((356.0, 252.0)),
     pt((344.0, 240.0)), pt((332.0, 232.0)), pt((322.0, 226.0)), C_WING_TIP,
     pt((396.0, 186.0)), pt((376.0, 200.0)), pt((352.0, 224.0)), pt((336.0, 242.0)),
     C_BODY_LN,
     pt((428.0, 190.0)), pt((404.0, 206.0)), pt((378.0, 232.0)), pt((362.0, 248.0)),
     C_BODY_LN))

# near wing reaches forward and grips the handlebar
A('<g>%s'
  '<path d="M%sC%s %s %sC%s %s %sC%s %s %sZ" fill="%s" stroke="%s" '
  'stroke-width="1.8"/>'
  '<path d="M%sC%s %s %s" stroke="%s" stroke-width="1.5" fill="none" opacity="0.55"/>'
  '</g>'
  % (rot_anim(wing_vals, (438.0, 196.0)),
     pt((462.0, 186.0)), pt((488.0, 202.0)), pt((514.0, 228.0)), pt((536.0, 256.0)),
     pt((544.0, 266.0)), pt((549.0, 274.0)), pt((548.0, 283.0)),
     pt((539.0, 289.0)), pt((529.0, 283.0)), pt((521.0, 271.0)),
     "#f7fafc", C_BODY_LN,
     pt((470.0, 196.0)), pt((494.0, 214.0)), pt((518.0, 242.0)), pt((536.0, 268.0)),
     C_BODY_LN))

# neck + head + beak, with a gentle nod
A('<g>%s' % rot_anim(nod_vals, (452.0, 176.0)))
A('<path d="M%sC%s %s %s %sC%s %s %sZ" fill="url(#bodyGrad)" stroke="%s" '
  'stroke-width="2"/>'
  % (pt((446.0, 190.0)), pt((446.0, 158.0)), pt((468.0, 132.0)), pt((496.0, 120.0)),
     pt((508.0, 114.0)), pt((514.0, 122.0)), pt((506.0, 150.0)), pt((470.0, 200.0)),
     C_BODY_LN))
A('<ellipse cx="512" cy="112" rx="25" ry="22" fill="url(#bodyGrad)" stroke="%s" '
  'stroke-width="2"/>' % C_BODY_LN)
# beak: very long upper mandible + deep gular pouch (the pelican's signature)
A('<path d="M%sC%s %s %sC%s %s %sZ" fill="%s"/>'
  % (pt((526.0, 96.0)), pt((576.0, 96.0)), pt((646.0, 108.0)), pt((700.0, 130.0)),
     pt((644.0, 130.0)), pt((568.0, 118.0)), pt((526.0, 112.0)), C_BEAK))
A('<path d="M%sC%s %s %sC%s %s %sZ" fill="%s"/>'
  % (pt((528.0, 112.0)), pt((552.0, 186.0)), pt((630.0, 190.0)), pt((700.0, 130.0)),
     pt((640.0, 148.0)), pt((566.0, 142.0)), pt((528.0, 112.0)), C_POUCH))
A('<path d="M%sC%s %s %s" stroke="%s" stroke-width="1.8" fill="none" opacity="0.45"/>'
  % (pt((540.0, 122.0)), pt((576.0, 152.0)), pt((634.0, 156.0)), pt((686.0, 134.0)),
     "#c98a3f"))
A('<path d="M%sC%s %s %s" stroke="%s" stroke-width="1.6" fill="none" opacity="0.5"/>'
  % (pt((538.0, 114.0)), pt((590.0, 116.0)), pt((650.0, 122.0)), pt((694.0, 130.0)),
     "#d08a30"))
A('<circle cx="519" cy="104" r="5.2" fill="%s"/>' % C_EYE)
A('<circle cx="520.8" cy="102.2" r="1.7" fill="#ffffff"/>')
# scarf: band around the neck + knot + thin ribbon fluttering back and up
A('<path d="M%sC%s %s %s" stroke="%s" stroke-width="11" stroke-linecap="round" '
  'fill="none"/>'
  % (pt((464.0, 182.0)), pt((474.0, 170.0)), pt((498.0, 168.0)), pt((510.0, 178.0)),
     C_SCARF))
A('<circle cx="492" cy="180" r="7.5" fill="%s"/>' % C_SCARF)
scarf_vals = []
for i in range(N + 1):
    th = 2.0 * math.pi * i / N
    w1 = 4.5 * math.sin(3.0 * th)
    w2 = 7.0 * math.sin(3.0 * th - 0.9)
    w3 = 5.0 * math.sin(3.0 * th - 1.7)
    scarf_vals.append("M492 176C%s %s %sC%s %s %sZ"
                      % (pt((474.0, 166.0 + w1)), pt((452.0, 152.0 + w2)),
                         pt((432.0, 138.0 + w3)),
                         pt((446.0, 158.0 + w2)), pt((472.0, 176.0 + w1)),
                         pt((492.0, 188.0))))
A('<path d="%s" fill="%s" opacity="0.95">'
  '<animate attributeName="d" calcMode="linear" values="%s" dur="%ss" '
  'repeatCount="indefinite"/></path>'
  % (scarf_vals[0], C_SCARF, kf(scarf_vals), n2(LOOP)))
A('</g>')   # neck group
A('</g></g>')  # body group

# ---------------------------------------------------------------- controls
A('<g id="toggle-anim" role="button" tabindex="0" aria-pressed="false" '
  'aria-label="Pause animation">')
A('<rect class="btn-bg" x="28" y="468" width="168" height="48" rx="24" fill="#ffffff" '
  'fill-opacity="0.92" stroke="#2e7d8f" stroke-width="1.6"/>')
A('<g id="icon-pause" fill="#1d4f5c"><rect x="56" y="481" width="6" height="22" rx="2"/>'
  '<rect x="68" y="481" width="6" height="22" rx="2"/></g>')
A('<g id="icon-play" fill="#1d4f5c" style="display:none">'
  '<path d="M57 481L78 492L57 503Z"/></g>')
A('<text id="toggle-label" x="92" y="499" font-family="ui-sans-serif, -apple-system, '
  '&quot;Segoe UI&quot;, Roboto, Helvetica, Arial, sans-serif" font-size="18" '
  'font-weight="600" fill="#1d4f5c">Pause</text>')
A('</g>')

A('</g>')  # clip

A('<style><![CDATA['
  '#toggle-anim{cursor:pointer}'
  '#toggle-anim:hover .btn-bg{fill:#eef8fa}'
  '#toggle-anim:focus{outline:none}'
  '#toggle-anim:focus .btn-bg{stroke-width:3.4}'
  ']]></style>')

A('<script><![CDATA[')
A('(function(){')
A('  var svg=document.getElementById("pelican-svg");')
A('  var btn=document.getElementById("toggle-anim");')
A('  var label=document.getElementById("toggle-label");')
A('  var ip=document.getElementById("icon-play");')
A('  var ic=document.getElementById("icon-pause");')
A('  var paused=false;')
A('  function paint(){')
A('    label.textContent=paused?"Resume":"Pause";')
A('    ip.style.display=paused?"":"none";')
A('    ic.style.display=paused?"none":"";')
A('    btn.setAttribute("aria-pressed",paused?"true":"false");')
A('    btn.setAttribute("aria-label",paused?"Resume animation":"Pause animation");')
A('  }')
A('  function setPaused(p){')
A('    paused=p;')
A('    if(p){svg.pauseAnimations();}else{svg.unpauseAnimations();}')
A('    paint();')
A('  }')
A('  btn.addEventListener("click",function(){setPaused(!paused);});')
A('  btn.addEventListener("keydown",function(e){')
A('    if(e.key===" "||e.key==="Enter"){e.preventDefault();setPaused(!paused);}'
  'else if(e.key==="Escape"&&paused){setPaused(false);}')
A('  });')
A('  paint();')
A('})();')
A(']]></script>')

A('</svg>')

svg = "\n".join(out) + "\n"
with open("pelican-bicycle.svg", "w", encoding="utf-8") as f:
    f.write(svg)
print("wrote pelican-bicycle.svg  (%d bytes)" % len(svg.encode("utf-8")))
print("chain: length=%.1f links=%d dash=%.2f adv=%.1f" % (chain_len, LINKS, dash_period, chain_adv))
print("ground shift/loop = %.2f px, wheel revs/loop = %.3f, crank revs/loop = 1" % (SHIFT, SHIFT / (2 * math.pi * WHEEL_R)))
for name, ph in (("near", 0.0), ("far", math.pi)):
    th_list = [2 * math.pi * i / N for i in range(N)]
    ds = []
    for th in th_list:
        p = pedal_pos(th + ph)
        a = (p[0] + ANKLE_OFF[0], p[1] + ANKLE_OFF[1])
        ds.append(math.hypot(a[0] - HIP[0], a[1] - HIP[1]))
    print("%s leg: reach %.1f .. %.1f (thigh+shin=%.0f)" % (name, min(ds), max(ds), THIGH + SHIN))
