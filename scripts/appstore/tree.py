import json,sys
try: d=json.load(sys.stdin)
except Exception as e: print("no ui:",e); sys.exit(0)
def walk(n):
    f=n.get('frame',{}) or {}
    lab=(n.get('AXLabel') or n.get('title') or n.get('AXValue') or '')
    t=n.get('type','')
    x,y,w,h=f.get('x',0),f.get('y',0),f.get('width',0),f.get('height',0)
    if (lab and str(lab).strip()) or t in ('Button','TextField','SecureTextField','Cell'):
        cx,cy=x+w/2,y+h/2
        print(f"{t:16} c=({cx:.0f},{cy:.0f}) [{x:.0f},{y:.0f} {w:.0f}x{h:.0f}]  {str(lab)[:60]}")
    for c in (n.get('children') or []): walk(c)
for n in (d if isinstance(d,list) else [d]): walk(n)
