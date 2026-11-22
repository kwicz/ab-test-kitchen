"""Turn single-line drawings (dark line on light ground, PNG) into stroked SVGs.

Usage: python3 scripts/trace-art.py <in.png> <out.svg>

Steps: threshold, crop to the drawing, thin the line to a 1px skeleton
(ImageMagick), walk the skeleton into pixel chains, simplify them, and write
them as stroked paths. Strokes use vector-effect: non-scaling-stroke, so the
line stays the same width at any display size, from a 14px badge to a hero.
"""
import subprocess
import sys

INK = '#22302c'
STROKE = 1  # CSS px at any size
MIN_CHAIN = 10  # drop skeleton spurs shorter than this (source px)
EPS = 1.1  # simplification tolerance (source px)


def magick(*args):
    return subprocess.run(['magick', *args], capture_output=True, check=True).stdout


def skeleton(path):
    # White line on black, cropped with a margin, closed slightly, thinned to 1px.
    raw = magick(
        path, '-colorspace', 'gray', '-threshold', '55%', '-negate',
        '-trim', '+repage', '-bordercolor', 'black', '-border', '24',
        '-morphology', 'Close', 'Disk:1.5',
        '-morphology', 'Thinning:-1', 'Skeleton', '-depth', '8', 'pgm:-',
    )
    # Parse binary PGM.
    parts = raw.split(maxsplit=4)
    w, h = int(parts[1]), int(parts[2])
    data = parts[4]
    on = {(x, y) for y in range(h) for x in range(w) if data[y * w + x] > 127}
    return w, h, on


NB = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]


def neighbors(p, on):
    x, y = p
    return [(x + dx, y + dy) for dx, dy in NB if (x + dx, y + dy) in on]


def chains(on):
    """Walk the skeleton pixel by pixel. Each pixel is used once; a walk keeps
    going straight where it can and stops when no unvisited neighbor is left.
    Ends of lines are walked first so open strokes come out whole."""
    seen = set()
    out = []

    def walk(start):
        line = [start]
        seen.add(start)
        cur, heading = start, None
        while True:
            step = [n for n in neighbors(cur, on) if n not in seen]
            if not step:
                break

            def cost(n):
                d = (n[0] - cur[0], n[1] - cur[1])
                turn = 0 if heading is None else abs(d[0] - heading[0]) + abs(d[1] - heading[1])
                return (turn, abs(d[0]) + abs(d[1]))

            nxt = min(step, key=cost)
            heading = (nxt[0] - cur[0], nxt[1] - cur[1])
            # Mark the other candidates around a staircase corner as seen so they don't spawn 1px chains.
            for n in step:
                if n != nxt and max(abs(n[0] - nxt[0]), abs(n[1] - nxt[1])) <= 1:
                    seen.add(n)
            seen.add(nxt)
            line.append(nxt)
            cur = nxt
        # Close loops that end next to where they started.
        if len(line) > 8 and max(abs(line[0][0] - cur[0]), abs(line[0][1] - cur[1])) <= 1:
            line.append(line[0])
        return line

    ends = sorted(p for p in on if len(neighbors(p, on)) == 1)
    for p in ends:
        if p not in seen:
            out.append(walk(p))
    for p in sorted(on):
        if p not in seen:
            out.append(walk(p))
    return out


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5
    best, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        x0, y0 = pts[i]
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm if norm else ((x0 - x1) ** 2 + (y0 - y1) ** 2) ** 0.5
        if d > best:
            best, idx = d, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[: idx + 1], eps)[:-1] + rdp(pts[idx:], eps)


def to_path(pts):
    # Smooth the simplified polyline with Catmull-Rom curves.
    if len(pts) < 3:
        return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    d = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    return ''.join(d)


def main(src, dst):
    w, h, on = skeleton(src)
    lines = [c for c in chains(on) if len(c) >= MIN_CHAIN]
    paths = [to_path(rdp(c, EPS)) for c in lines]
    side = max(w, h)
    ox, oy = (side - w) / 2, (side - h) / 2
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-ox:.0f} {-oy:.0f} {side} {side}" fill="none" '
        f'stroke="{INK}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round">'
        '<style>path{vector-effect:non-scaling-stroke}</style>'
        f'<path d="{" ".join(paths)}"/></svg>\n'
    )
    open(dst, 'w').write(svg)
    print(f'{dst}: {len(lines)} strokes, {len(svg) // 1024} KB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
