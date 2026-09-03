#!/usr/bin/env python3
"""glass-icon.py: Raycast-style liquid-glass icon tiles. Rounded square, vertical gradient of ONE hue,
inner top highlight, soft outer shadow, white glyph (Asyar's lucide SVG path or an emoji/PNG) centered.
  glass-icon.py --hue 210 --glyph icon:trash --out trash.png [--size 128]
  glass-icon.py --hue 30 --png source.png --out x.png          # re-tile a PNG glyph
"""
import argparse, colorsys, io, json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
ICON_DATA = os.path.expanduser('~/Developer/raycast-to-asyar/asyar/asyar-sdk/src/icons/iconData.ts')

def hsl(h, s, l): r, g, b = colorsys.hls_to_rgb(h / 360, l, s); return (int(r * 255), int(g * 255), int(b * 255))

def rounded(size, radius, fill):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); ImageDraw.Draw(im).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=fill); return im

def tile(size, hue, sat=0.62):
    # gradient: lighter top → deeper bottom (Raycast tiles read as lit from above)
    top, bot = hsl(hue, sat, 0.62), hsl(hue, sat, 0.42)
    grad = Image.new('RGBA', (size, size)); px = grad.load()
    for y in range(size):
        t = y / (size - 1); c = tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)) + (255,); 
        for x in range(size): px[x, y] = c
    mask = rounded(size, int(size * 0.235), (255, 255, 255, 255)).split()[3]
    body = Image.new('RGBA', (size, size), (0, 0, 0, 0)); body.paste(grad, (0, 0), mask)
    # glass: top inner highlight (white 28% → 0), bottom inner shade, 1px rim
    hl = Image.new('RGBA', (size, size), (0, 0, 0, 0)); hp = hl.load()
    for y in range(size // 2):
        a = int(70 * (1 - y / (size / 2)) ** 1.6)
        for x in range(size): hp[x, y] = (255, 255, 255, a)
    hl.putalpha(ImageChops.multiply(hl.split()[3], mask)); body = Image.alpha_composite(body, hl)
    rim = Image.new('RGBA', (size, size), (0, 0, 0, 0)); ImageDraw.Draw(rim).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.235), outline=(255, 255, 255, 60), width=max(1, size // 64))
    body = Image.alpha_composite(body, rim)
    return body

def glyph_svg(name):
    src = open(ICON_DATA).read()
    m = re.search(r"^\s*(?:'%s'|\"%s\"|%s)\s*:\s*`(.*?)`" % (re.escape(name), re.escape(name), re.escape(name)), src, re.S | re.M)
    if not m: sys.exit(f'icon {name} not in iconData.ts')
    return m.group(1)

def render_svg(inner, size, stroke=(255, 255, 255)):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="rgb{stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>'
    r = subprocess.run(['/opt/homebrew/bin/rsvg-convert', '-w', str(size), '-h', str(size)], input=svg.encode(), capture_output=True)
    if r.returncode != 0: sys.exit('rsvg-convert failed: ' + r.stderr.decode()[:200])
    return Image.open(io.BytesIO(r.stdout)).convert('RGBA')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--hue', type=float, required=True); ap.add_argument('--sat', type=float, default=0.62)
    ap.add_argument('--glyph'); ap.add_argument('--png'); ap.add_argument('--emoji'); ap.add_argument('--out', required=True); ap.add_argument('--size', type=int, default=256)
    a = ap.parse_args(); S = a.size
    body = tile(S, a.hue, a.sat)
    if a.glyph:
        g = render_svg(glyph_svg(a.glyph.replace('icon:', '')), int(S * 0.56))
    elif a.png:
        g = Image.open(a.png).convert('RGBA'); g.thumbnail((int(S * 0.66), int(S * 0.66)))
    elif a.emoji:
        # Render the emoji with CoreText (Swift) — PIL cannot load Apple Color Emoji's bitmap strikes.
        sw = 'import Cocoa; let s = CommandLine.arguments[1]; let px = Int(CommandLine.arguments[2])!; let img = NSImage(size: NSSize(width: px, height: px)); img.lockFocus(); NSColor.clear.set(); NSRect(x:0,y:0,width:px,height:px).fill(); let f = NSFont(name: "Apple Color Emoji", size: CGFloat(px) * 0.78)!; let a: [NSAttributedString.Key: Any] = [.font: f]; let sz = (s as NSString).size(withAttributes: a); (s as NSString).draw(at: NSPoint(x: (CGFloat(px) - sz.width) / 2, y: (CGFloat(px) - sz.height) / 2), withAttributes: a); img.unlockFocus(); let png = NSBitmapImageRep(data: img.tiffRepresentation!)!.representation(using: .png, properties: [:])!; try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[3]))'
        out = f'/tmp/_emoji_{os.getpid()}.png'; subprocess.run(['/usr/bin/swift', '-e', sw, a.emoji, str(int(S * 0.62)), out], capture_output=True, check=True)
        g = Image.open(out).convert('RGBA'); os.remove(out)
    else: sys.exit('need --glyph, --png or --emoji')
    # drop shadow under the glyph for depth
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sh.paste((0, 0, 0, 90), ((S - g.width) // 2, (S - g.height) // 2 + max(1, S // 64)), g.split()[3]); sh = sh.filter(ImageFilter.GaussianBlur(S / 64))
    body = Image.alpha_composite(body, sh); body.paste(g, ((S - g.width) // 2, (S - g.height) // 2), g)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True); body.save(a.out); print('wrote', a.out)
if __name__ == '__main__': main()
