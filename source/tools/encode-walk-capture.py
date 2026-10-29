"""Encode only actual runtime compositor captures, never source sprite mockups."""
from pathlib import Path
from PIL import Image
from io import BytesIO
import json,base64,sys

out=Path(sys.argv[1])
record=json.loads((out/'captured-compositor-frames.json').read_text())
images=[Image.open(BytesIO(base64.b64decode(s))).convert('RGB') for s in record['images']]
assert len(images)==120 and all(im.size==(393,852) for im in images)
palette=images[0].quantize(colors=256)
frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in images]
times=record['times']
durations=[max(10,round((times[i+1]-times[i])/10)*10) for i in range(len(times)-1)]
durations.append(durations[-1])
frames[0].save(out/'player-walk-runtime.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True)
clips=[im.crop((132,350,264,510)).resize((264,320),Image.Resampling.NEAREST).quantize(colors=128) for im in images]
clips[0].save(out/'player-walk-detail.gif',save_all=True,append_images=clips[1:],duration=durations,loop=0,optimize=True)
decoded=Image.open(out/'player-walk-runtime.gif')
assert decoded.n_frames>80
report={'format':'GIF','size':list(decoded.size),'decodedFrames':decoded.n_frames,'capturedFrames':len(images),'capturedDurationMs':record['times'][-1],'playbackDurationMs':sum(durations),'bytes':(out/'player-walk-runtime.gif').stat().st_size,'note':'实际Cocos桌面合成器采样；不是实时帧率或安卓真机性能录像。局部GIF为实际画面最近邻2倍裁切。'}
(out/'capture-gif-info.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
