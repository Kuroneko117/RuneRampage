"""QA contact animation from actual Cocos crops. Does not create runtime artwork."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,sys
out=Path(sys.argv[1]);prefix=sys.argv[2]
record=json.loads((out/(prefix+'-comparison.json')).read_text())
frames=[]
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',12)
for p in sorted((out/(prefix+'-frames')).glob('*.png')):
    image=Image.open(p).convert('RGB')
    frame=Image.new('RGB',(288,132),'#111423');frame.paste(image,(0,22))
    draw=ImageDraw.Draw(frame)
    for x,text in [(0,'玩家'),(96,'史莱姆'),(192,'蝙蝠')]:draw.text((x+24,3),text,fill='#e8e7f3',font=font)
    frames.append(frame)
times=[r['ms'] for r in record['rows']]
durations=[max(10,round((b-a)/10)*10) for a,b in zip(times,times[1:])];durations.append(durations[-1])
frames[0].save(out/(prefix+'-comparison.gif'),save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True)
frames[0].resize((576,264),Image.Resampling.NEAREST).save(out/(prefix+'-comparison-first.png'))
decoded=Image.open(out/(prefix+'-comparison.gif'));assert decoded.n_frames>=30
print(json.dumps({'frames':decoded.n_frames,'size':list(decoded.size),'durationMs':sum(durations),'method':'Actual Cocos native-sized actor crops, labelled only for QA.'}))
