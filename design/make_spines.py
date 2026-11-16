import json, random
exec(open("/home/claude/make_soft.py").read().split('open("LogoSoftLine.dc.html"')[0])
SPINES_PASTEL = ["#f2a99a", "#bcd7a4", "#9cc6e8", "#f6d58e", "#d9c2e6", "#f7c9b6", "#a9d3c8", "#ead8b8"]
SPINES_LINE = ["#f8d3c9", "#dbe9cd", "#cfe2f2", "#fbe7bd", "#ead9f1", "#fbe1d6", "#d3ebe4", "#f3e8d4"]

def spine_row(x0, x1, base, hmin, hmax, widths, gap, r, colors, edge, detail, op, with_detail=True):
    out, x, i = [], x0, 0
    while x < x1:
        w = r.choice(widths); h = r.uniform(hmin, hmax); top = base - h
        out.append(f'<path d="{picket(x, top, w, h, r)}" fill="{colors[i % len(colors)]}" {edge}/>')
        if with_detail:
            for f in (0.30, 0.78):
                yy = top + h * f
                out.append(f'<path d="M{x+w*0.17:.1f},{yy:.1f} L{x+w*0.83:.1f},{yy+r.uniform(-0.5,0.5):.1f}" stroke="{detail}" stroke-width="{max(0.8, w*0.08):.1f}" stroke-linecap="round" opacity="{op}"/>')
            ty = top + h * 0.42
            out.append(f'<path d="M{x+w/2:.1f},{ty:.1f} L{x+w/2:.1f},{ty+h*0.24:.1f}" stroke="{detail}" stroke-width="{max(1, w*0.1):.1f}" stroke-linecap="round" opacity="{op}"/>')
        x += w + gap * r.uniform(0.85, 1.15); i += 1
    return out

def spine_lockup(variant, word_fill=None, seed=11):
    r = random.Random(seed)
    outline = variant == "line"
    ink = "#4a3b30"
    word = word_fill or (ink if outline else "#3d3029")
    grass_stroke = "#6f9a5b" if outline else "#8ab577"
    can_fill, can_acc, berry, leaf, water = ("#f4b9aa", "#e88a7b", "#ec8b7d", "#a8c98f", "#8fbbe0") if outline else ("#f2a99a", "#e48877", "#e9806f", "#8ab577", "#9cc6e8")
    sw = 2.2
    edge = f'stroke="{ink}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"' if outline else ""
    p = [f'<path d="M86,312 C180,298 300,302 360,301 C440,300 560,298 636,312 C560,322 160,322 86,312 Z" fill="{"#e3efd6" if outline else "#bcd7a4"}" opacity="0.9"/>']
    for ry in (270, 290):
        p.append(f'<path d="{wobble(104, ry, 616, ry + r.uniform(-1, 1), r, 10, 1.0)}" fill="none" stroke="{ink}" stroke-width="{sw}" stroke-linecap="round"/>' if outline
                 else f'<rect x="104" y="{ry}" width="512" height="7" rx="3.5" fill="#efe6d8"/>')
    p += spine_row(108, 600, 309, 44, 58, [14, 15, 16, 17, 18], 9.5, r, SPINES_LINE if outline else SPINES_PASTEL, edge, ink if outline else "#ffffff", "0.55" if outline else "0.75")
    p.append(f'<text x="360" y="232" text-anchor="middle" font-family="\'Cormorant Garamond\', Georgia, serif" font-style="italic" font-weight="600" font-size="118" fill="{word}" letter-spacing="0.5">bookpatch</text>')
    for cx in [96, 130, 214, 262, 330, 402, 470, 508, 590, 628]:
        for d in tuft(cx, 311, r, r.uniform(0.9, 1.25)):
            p.append(f'<path d="{d}" fill="none" stroke="{grass_stroke}" stroke-width="{2.1 if outline else 2.6}" stroke-linecap="round"/>')
    bi = ink if outline else "#c4604f"
    for x, y, s in [(160, 300, 1.55), (186, 306, 1.15), (560, 302, 1.45)]:
        p.append(strawberry_soft(x, y, s, berry, bi, leaf))
    p.append(can_soft(600, 86, -24, 0.95, can_fill, ink, can_acc, sw if outline else 0))
    p.append(drops_soft((504, 112), r, water))
    return "".join(p)

def wrap(inner, vb="0 0 720 360", label="bookpatch logo"):
    return f'<svg viewBox="{vb}" width="720" height="360" role="img" aria-label="{label}">{inner}</svg>'

if __name__ == "__main__":
    import os
    os.chdir("/home/claude/design/project")
    lbl = "bookpatch logo: the word bookpatch above a fence made of book spines, with grass tufts, strawberries, and a watering can sprinkling water"
    open("LogoSpinesPastel.dc.html", "w").write(page("bookpatch logo with a book-spine fence, pastel", "#fffdf9", wrap(spine_lockup("pastel"), label=lbl), 880, 520))
    open("LogoSpinesLine.dc.html", "w").write(page("bookpatch logo with a book-spine fence, line", "#fffdf9", wrap(spine_lockup("line"), label=lbl), 880, 520))
    # In-app version: word follows light/dark mode, tighter crop
    full = f'<svg viewBox="70 30 590 296" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">{spine_lockup("pastel", word_fill="currentColor")}</svg>'
    r = random.Random(5)
    c = ['<path d="M2,45 C40,41 120,41 178,45" stroke="#bcd7a4" stroke-width="4" stroke-linecap="round" fill="none"/>',
         '<rect x="6" y="37" width="166" height="2.4" rx="1.2" fill="#efe6d8"/>']
    c += spine_row(8, 168, 45, 9, 12, [4.5, 5, 5.5], 3.2, r, SPINES_PASTEL, "", "#fff", "0.75", with_detail=False)
    c.append('<text x="88" y="31" text-anchor="middle" font-family="\'Cormorant Garamond\', Georgia, serif" font-style="italic" font-weight="600" font-size="36" fill="currentColor">bookpatch</text>')
    c.append(strawberry_soft(170, 9, 0.62, "#e9806f", "#c4604f", "#8ab577"))
    compact = f'<svg viewBox="0 -4 182 54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">{"".join(c)}</svg>'
    open("/home/claude/stacks-app/client/src/components/logoArt.ts", "w").write(
        "// Generated by make_spines.py from the logo design canvas. The word uses currentColor so it follows light/dark mode.\n"
        f"export const LOGO_FULL = {json.dumps(full)};\nexport const LOGO_COMPACT = {json.dumps(compact)};\n")
    print("ok")
