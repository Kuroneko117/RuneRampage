"""Asset identity/loop/budget checks; gameplay readability still needs visual QA."""
from pathlib import Path
from PIL import Image
import numpy as np
import json,re

root=Path(__file__).resolve().parents[2]
source=root/'art-source/player-walk-20261025'
reference=np.asarray(Image.open(source/'reference.png').convert('RGBA'))
frames=[np.asarray(Image.open(source/f'walk-{i:02}.png').convert('RGBA')) for i in range(1,13)]
assert len({frame.tobytes() for frame in frames})==12
for frame in frames:
    assert frame.shape==(88,80,4)
    visible=reference[:60,:,3]>0
    assert np.array_equal(frame[:60][visible],reference[:60][visible]),'Identity layer must remain pixel-exact'
    assert np.max(frame[:,:,3])==255 and np.min(frame[:,:,3])==0
    assert np.where(frame[60:,:,3]>100)[0].max()+60==77,'Planted boot ground line drifted'
changes=[int(np.any(frames[i]!=frames[(i+1)%12],axis=2).sum()) for i in range(12)]
assert max(changes)>0 and changes[-1]<=max(changes[:-1])*1.15,'Loop seam is an outlier'
old_catalog=(source/'catalog-before.ts').read_text(encoding='utf-8')
catalog=(root/'assets/scripts/ArtCatalog.ts').read_text(encoding='utf-8')
parse=lambda text:json.loads(re.search(r'ART_FRAMES[^=]*=(.*?);',text).group(1))
old_frames,new_frames=parse(old_catalog),parse(catalog)
old=Image.open(source/'combat-before.png').convert('RGBA')
new=Image.open(root/'assets/resources/art/v08/combat.png').convert('RGBA')
assert old.size==new.size==(1024,768)
preserved=0
for name,a in old_frames.items():
    if a[0]!='combat' or name.startswith(('player_move_','player_attack_','player_overload_')):continue
    b=new_frames[name]
    assert a[3:]==b[3:]
    assert old.crop((a[1],a[2],a[1]+a[3],a[2]+a[4])).tobytes()==new.crop((b[1],b[2],b[1]+b[3],b[2]+b[4])).tobytes(),name
    preserved+=1
report={'distinctFrames':12,'fps':16,'cycleSeconds':.75,'identityPixelsExact':True,'groundRow':77,'adjacentChangedPixels':changes,'preservedAtlasFrames':preserved,'textureSizeUnchanged':True,'note':'分层关键帧与图集的技术检查，不替代实际游戏尺寸观感审查。'}
(root/'docs/player-walk-20261025/asset-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
