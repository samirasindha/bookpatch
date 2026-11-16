import json, math, random

def smooth(pts, closed=False):
    """Catmull-Rom through points -> cubic bezier path (soft, hand-drawn curves)."""
    if closed: pts = pts + pts[:3]
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    rng = range(len(pts) - 3) if closed else range(len(pts) - 1)
    for i in rng:
        p0 = pts[i - 1] if i > 0 or closed else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d + (" Z" if closed else "")

def wobble(x0, y0, x1, y1, r, n=6, amp=1.2):
    pts = []
    for i in range(n + 1):
        t = i / n
        j = 0 if i in (0, n) else r.uniform(-amp, amp)
        pts.append((x0 + (x1 - x0) * t + j * 0.4, y0 + (y1 - y0) * t + j))
    return smooth(pts)

def picket(x, top, w, h, r):
    """Rounded-top picket with slightly uneven sides."""
    j = lambda a=0.9: r.uniform(-a, a)
    pts = [(x + j(), top + h), (x + j(0.6), top + w * 0.55), (x + w * 0.18, top + w * 0.12 + j(0.5)),
           (x + w / 2 + j(0.5), top + j(0.6)), (x + w * 0.82, top + w * 0.12 + j(0.5)),
           (x + w + j(0.6), top + w * 0.55), (x + w + j(), top + h)]
    return smooth(pts) + " Z"

def tuft(cx, base, r, scale=1.0, n=5):
    paths = []
    for k in range(n):
        dx = (k - (n - 1) / 2) * 3.2 * scale
        h = r.uniform(9, 17) * scale
        lean = (k - (n - 1) / 2) * 2.2 * scale + r.uniform(-1.5, 1.5)
        paths.append(f"M{cx+dx:.1f},{base:.1f} Q{cx+dx+lean*0.3:.1f},{base-h*0.6:.1f} {cx+dx+lean:.1f},{base-h:.1f}")
    return paths

def strawberry_soft(x, y, s, fill, ink, leaf):
    body = "M0,-5 C6,-7 9.5,-1.5 7.2,5 C5.4,10 1.6,13 0,13.6 C-1.6,13 -5.4,10 -7.2,5 C-9.5,-1.5 -6,-7 0,-5 Z"
    seeds = "".join(f'<path d="M{a},{b} l0.3,1.4" stroke="{ink}" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>' for a, b in [(-3, 0), (2.5, -1), (0, 5), (-3.6, 6.5), (3.4, 6), (0, 10)])
    leaves = f'<path d="M-6.5,-5.5 Q-3,-3 0,-4.5 Q3,-3 6.5,-5.5 Q3,-7.5 1,-6.6 L0,-10 L-1,-6.6 Q-3,-7.5 -6.5,-5.5 Z" fill="{leaf}" stroke="{ink}" stroke-width="1.1" stroke-linejoin="round"/>'
    return f'<g transform="translate({x} {y}) scale({s})"><path d="{body}" fill="{fill}" stroke="{ink}" stroke-width="1.1" stroke-linejoin="round"/>{seeds}{leaves}</g>'

def can_soft(x, y, rot, s, fill, ink, accent, sw):
    """Watering can. sw > 0.5 draws brown outlines (line style); otherwise it's outline-free pastel,
    and the handle, spout and rim are drawn as solid colored shapes."""
    outlined = sw > 0.5
    line = ink if outlined else accent
    body_stroke = f'stroke="{ink}" stroke-width="{sw}"' if outlined else ""
    spout_w = 11
    return f'''<g transform="translate({x} {y}) rotate({rot}) scale({s})" stroke-linecap="round" stroke-linejoin="round">
  <path d="M-26,-30 C-24,-68 26,-68 28,-30" fill="none" stroke="{line}" stroke-width="{sw if outlined else 7}"/>
  {f'<path d="M-42,8 C-62,4 -84,-6 -100,-20" fill="none" stroke="{ink}" stroke-width="{spout_w + 2*sw}"/>' if outlined else ""}
  <path d="M-42,8 C-62,4 -84,-6 -100,-20" fill="none" stroke="{fill}" stroke-width="{spout_w}"/>
  <circle cx="-104" cy="-24" r="9" fill="{accent}" {body_stroke}/>
  <path d="M-40,-26 C-41,0 -38,22 -32,32 C-10,36 12,36 34,32 C40,22 42,0 41,-26 C14,-31 -14,-31 -40,-26 Z" fill="{fill}" {body_stroke}/>
  <path d="M-44,-28 C-16,-34 16,-34 45,-28" fill="none" stroke="{line}" stroke-width="{sw*1.6 if outlined else 6}"/>
  <path d="M-24,0 C-10,3 10,3 24,0" fill="none" stroke="{line}" stroke-width="{sw*0.8 if outlined else 2.5}" opacity="0.4"/>
</g>'''

def drops_soft(origin, r, color, n=9):
    ox, oy = origin
    out = []
    for i in range(n):
        ang = math.radians(r.uniform(105, 150))
        dist = r.uniform(18, 70)
        x, y = ox + math.cos(ang) * dist, oy + math.sin(ang) * dist
        rad = r.uniform(1.8, 3.4)
        out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rad*0.75:.1f}" ry="{rad:.1f}" fill="{color}" opacity="{r.uniform(0.55, 0.95):.2f}" transform="rotate(25 {x:.1f} {y:.1f})"/>')
    return "".join(out)

def lockup(variant, seed=7):
    r = random.Random(seed)
    if variant == "line":
        ink, word = "#4a3b30", "#4a3b30"
        fence_fill, grass_fill, grass_stroke = "#fffaf2", "none", "#6f9a5b"
        can_fill, can_acc, berry, leaf, water = "#f4b9aa", "#e88a7b", "#ec8b7d", "#a8c98f", "#8fbbe0"
        sw, outline = 2.2, True
    else:  # pastel, no outlines
        ink, word = "#4a3b30", "#3d3029"
        fence_fill, grass_fill, grass_stroke = "#ffffff", "#bcd7a4", "#8ab577"
        can_fill, can_acc, berry, leaf, water = "#f2a99a", "#e48877", "#e9806f", "#8ab577", "#9cc6e8"
        sw, outline = 2.0, False

    stroke = f'stroke="{ink}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"' if outline else 'stroke="#e8e0d4" stroke-width="1.4" stroke-linejoin="round"'
    parts = []
    # ground: a soft mound instead of a hard strip
    parts.append(f'<path d="M86,312 C180,298 300,302 360,301 C440,300 560,298 636,312 C560,322 160,322 86,312 Z" fill="{"#e3efd6" if outline else grass_fill}" opacity="{0.9 if outline else 0.85}"/>')
    # fence rails then rounded pickets
    rail = 'stroke-width="9"' if not outline else ""
    for ry in (268, 288):
        if outline:
            parts.append(f'<path d="{wobble(104, ry, 616, ry + r.uniform(-1, 1), r, 10, 1.0)}" fill="none" stroke="{ink}" stroke-width="{sw}" stroke-linecap="round"/>')
            parts.append(f'<path d="{wobble(104, ry + 7, 616, ry + 7 + r.uniform(-1, 1), r, 10, 1.0)}" fill="none" stroke="{ink}" stroke-width="{sw}" stroke-linecap="round"/>')
        else:
            parts.append(f'<rect x="104" y="{ry}" width="512" height="8" rx="4" fill="{fence_fill}" stroke="#e8e0d4" stroke-width="1.2"/>')
    x = 110
    while x < 600:
        h = r.uniform(48, 54)
        parts.append(f'<path d="{picket(x, 308 - h, 15, h, r)}" fill="{fence_fill}" {stroke}/>')
        x += 25 + r.uniform(-1.5, 1.5)
    # word
    parts.append(f'<text x="360" y="232" text-anchor="middle" font-family="\'Cormorant Garamond\', Georgia, serif" font-style="italic" font-weight="600" font-size="118" fill="{word}" letter-spacing="0.5">bookpatch</text>')
    # grass tufts along the fence base
    for cx in [96, 130, 214, 262, 330, 402, 470, 508, 590, 628]:
        for d in tuft(cx, 311, r, r.uniform(0.9, 1.25)):
            parts.append(f'<path d="{d}" fill="none" stroke="{grass_stroke}" stroke-width="{2.1 if outline else 2.6}" stroke-linecap="round"/>')
    # strawberries tucked into the grass
    parts.append(strawberry_soft(160, 300, 1.55, berry, ink if outline else "#c4604f", leaf))
    parts.append(strawberry_soft(186, 306, 1.15, berry, ink if outline else "#c4604f", leaf))
    parts.append(strawberry_soft(560, 302, 1.45, berry, ink if outline else "#c4604f", leaf))
    # watering can + a gentle sprinkle
    parts.append(can_soft(600, 86, -24, 0.95, can_fill, ink if outline else can_acc, can_acc, sw if outline else 0.01))
    parts.append(drops_soft((504, 112), r, water))
    return f'<svg viewBox="0 0 720 360" width="720" height="360" role="img" aria-label="bookpatch logo, hand-drawn: the word bookpatch above a picket fence, grass tufts and strawberries, with a watering can sprinkling water over it">{"".join(parts)}</svg>'

def page(title, bg, body, w, h):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600;1,700&amp;display=swap">
<style>
body{{margin:0}}
a{{color:#d63a24}}a:hover{{color:#a82a17}}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; box-sizing: border-box; background: {bg}; display: flex; align-items: center; justify-content: center">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
'''

open("LogoSoftLine.dc.html", "w").write(page("bookpatch logo, soft line drawing", "#fffdf9", lockup("line"), 880, 520))
open("LogoSoftPastel.dc.html", "w").write(page("bookpatch logo, soft pastel", "#fffdf9", lockup("pastel"), 880, 520))

c = json.load(open("canvas.json"))
c["boards"]["LogoSoftLine.dc.html"] = {"x": 0, "y": 3968, "w": 880, "h": 520, "title": "Softer A: hand-drawn line"}
c["boards"]["LogoSoftPastel.dc.html"] = {"x": 960, "y": 3968, "w": 880, "h": 520, "title": "Softer B: pastel, no outlines"}
for k in ["LogoSoftLine.dc.html", "LogoSoftPastel.dc.html"]:
    if k not in c["order"]: c["order"].append(k)
c["notes"]["softer"] = {"x": 0, "y": 3728, "text": "Softer versions", "kind": "title1", "maxW": 1840}
json.dump(c, open("canvas.json", "w"), indent=2)
