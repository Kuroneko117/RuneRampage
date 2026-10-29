"""Repack the existing indexed atlas without changing any non-player pixels.

Run after prepare-player-walk.py. The reviewed source frames remain outside assets.
Only the twelve unused, incompatible old move/attack/overload poses are replaced.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import json, re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source/player-walk-20261025'
runtime = ROOT / 'assets/resources/art/v08/combat.png'
catalog = ROOT / 'assets/scripts/ArtCatalog.ts'
if not (SOURCE / 'combat-before.png').exists():
    (SOURCE / 'combat-before.png').write_bytes(runtime.read_bytes())
    (SOURCE / 'catalog-before.ts').write_bytes(catalog.read_bytes())
text = (SOURCE / 'catalog-before.ts').read_text(encoding='utf-8')
frames = json.loads(re.search(r'ART_FRAMES[^=]*=(.*?);',text).group(1))
animations = json.loads(re.search(r'ART_ANIMATIONS[^=]*=(.*?);',text).group(1))
old = Image.open(SOURCE / 'combat-before.png')
assert old.mode == 'P'
swatch=Image.new('P',(256,1));swatch.putpalette(old.getpalette());swatch.info.update(old.info)
swatch.putdata(list(range(256)))
rgba=np.asarray(swatch.convert('RGBA')).reshape(256,4).astype(np.int32)
transparent = int(np.argmin(rgba[:,3]))
items = {}
for name,a in list(frames.items()):
    if a[0] != 'combat': continue
    if name.startswith(('player_move_', 'player_attack_', 'player_overload_')):
        del frames[name]
        continue
    _,x,y,w,h,*_ = a
    items[name] = old.crop((x,y,x+w,y+h))

walk_names = []
for i in range(12):
    name = f'player_walk_{i+1:02}'
    walk_names.append(name)
    source = Image.open(SOURCE / f'walk-{i+1:02}.png').convert('RGBA')
    pixels = np.asarray(source).astype(np.int32)
    unique, inverse = np.unique(pixels.reshape(-1,4), axis=0, return_inverse=True)
    delta = unique[:,None,:] - rgba[None,:,:]
    # Alpha matters more than RGB in transparent pixels; never bake a matte.
    distance = np.sum(delta[:,:,:3]**2,axis=2) + delta[:,:,3]**2*4
    best = distance.argmin(axis=1).astype(np.uint8)
    best[unique[:,3]==0] = transparent
    indexed = Image.fromarray(best[inverse].reshape(88,80), 'P')
    indexed.putpalette(old.getpalette()); indexed.info.update(old.info)
    bounds = indexed.convert('RGBA').getchannel('A').getbbox()
    assert bounds
    x,y,r,b = bounds
    items[name] = indexed.crop(bounds)
    frames[name] = ['combat',0,0,r-x,b-y,80,88,x,y,.5,.125]

def pack(width,height):
    free = [(0,0,width,height)]
    result = {}
    for name,im in sorted(items.items(),key=lambda item:max(item[1].size)*10000+item[1].width*item[1].height,reverse=True):
        bw,bh=im.width+4,im.height+4
        fits=[(min(w-bw,h-bh),max(w-bw,h-bh),i) for i,(x,y,w,h) in enumerate(free) if bw<=w and bh<=h]
        if not fits:return None
        _,_,idx=min(fits);x,y,_,_=free[idx];split=[]
        for fx,fy,fw,fh in free:
            if x+bw<=fx or x>=fx+fw or y+bh<=fy or y>=fy+fh:split.append((fx,fy,fw,fh));continue
            if x>fx:split.append((fx,fy,x-fx,fh))
            if x+bw<fx+fw:split.append((x+bw,fy,fx+fw-x-bw,fh))
            if y>fy:split.append((fx,fy,fw,y-fy))
            if y+bh<fy+fh:split.append((fx,y+bh,fw,fy+fh-y-bh))
        free=[f for i,f in enumerate(split) if not any(i!=j and f[0]>=g[0] and f[1]>=g[1] and f[0]+f[2]<=g[0]+g[2] and f[1]+f[3]<=g[1]+g[3] and (f!=g or i>j) for j,g in enumerate(split))]
        result[name]=(x+2,y+2)
    return result

positions=pack(*old.size)
assert positions, 'New walk must fit the existing GPU texture budget'
atlas=Image.new('P',old.size,transparent);atlas.putpalette(old.getpalette());atlas.info.update(old.info)
for name,im in items.items():
    x,y=positions[name];atlas.paste(im,(x,y));frames[name][1:3]=[x,y]
    assert atlas.crop((x,y,x+im.width,y+im.height)).tobytes()==im.tobytes()
atlas.save(runtime,optimize=True,compress_level=9)
animations['player_move']={'frames':walk_names,'fps':16}
for key in ('player_attack','player_overload'):animations.pop(key,None)
catalog.write_text('/** Existing atlas pixels retained; reviewed 12-frame player walk. tools/pack-player-walk.py */\nexport const ART_FRAMES:Record<string,readonly (string|number)[]>='+json.dumps(frames,separators=(',',':'))+';\nexport const ART_ANIMATIONS:Record<string,{frames:string[];fps:number}>='+json.dumps(animations,separators=(',',':'))+';\n',encoding='utf-8')
report={'atlasSize':list(atlas.size),'oldBytes':(SOURCE/'combat-before.png').stat().st_size,'newBytes':runtime.stat().st_size,'frames':len(frames),'newWalkFrames':12,'fps':16,'nonPlayerPixelsUnchanged':True,'newTextureCount':0}
(ROOT/'docs/player-walk-20261025/atlas-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
