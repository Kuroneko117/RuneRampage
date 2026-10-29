"""Normalize the generated locomotion study; retain the approved head/staff layer.

Source artwork is generated with the built-in image tool, not synthesized here.
This script only slices, registers, composites fixed identity layers and exports.
"""
from pathlib import Path
from PIL import Image, ImageOps
import json, math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source/player-walk-20261025'
sheet = Image.open(SOURCE / 'revised-walk-sheet.png').convert('RGBA')
reference = Image.open(SOURCE / 'reference.png').convert('RGBA')
studies = []
for i in range(12):
    col, row = i % 4, i // 4
    cell = sheet.crop((col*362, row*362, (col+1)*362, (row+1)*362))
    bounds = cell.getchannel('A').point(lambda a: 255 if a >= 100 else 0).getbbox()
    assert bounds
    body = cell.crop(bounds).resize((76, 72), Image.Resampling.NEAREST)
    registered = Image.new('RGBA', (80, 88))
    registered.paste(body, (1, 8))
    studies.append(registered)

# Editable cutout layers, with explicit keys rather than trusting the generated
# sheet's nonuniform cell spacing/pose order. The generated full-body study is
# deliberately never shipped. Only its new boot artwork is used.
boot = studies[0].crop((34,68,43,79))
boot.save(SOURCE / 'layer-boot-front.png')
robe = reference.crop((25,60,58,74))
robe.save(SOURCE / 'layer-robe-hem.png')
fixed = reference.copy();fixed.paste((0,0,0,0),(25,60,58,88))
fixed.save(SOURCE / 'layer-fixed-identity.png')
frames = []
keys = []
for i in range(12):
    phase = i*math.tau/12
    frame = Image.new('RGBA',(80,88))
    foot_keys = []
    for side in range(2):
        angle = phase + side*math.pi
        swing = math.sin(angle)
        lift = max(0,-swing)
        # Contact, passing and raised poses have different leg length and toe
        # orientation. Feet alternate; grounded soles remain on y=78.
        height = 12-round(lift*3)
        width = 9-round(lift)
        limb = boot.resize((width,height),Image.Resampling.NEAREST)
        if side==0:limb=ImageOps.mirror(limb)
        tilt = round(math.cos(angle)*20*lift)
        limb = limb.rotate(tilt,Image.Resampling.NEAREST,expand=False)
        x = (28 if side==0 else 43)+round(math.cos(angle)*3)
        sole = 78-round(lift*6)
        frame.alpha_composite(limb,(x,sole-height))
        foot_keys.append({'x':x,'sole':sole,'width':width,'height':height,'angle':tilt})
    # Hem bends around the fixed waist with a slight delay after the knees.
    sway=math.sin(phase-math.pi/6)*2.5
    hem=robe.transform(robe.size,Image.Transform.AFFINE,(1,-sway/14,sway/2,0,1,0),Image.Resampling.NEAREST)
    # Each knee lifts its own hem panel, exposing the raised boot at phone size.
    # The waist stays fixed; this does not scale the head, torso or whole body.
    for side,(left,right) in enumerate(((0,16),(16,33))):
        lift=max(0,-math.sin(phase+side*math.pi))
        panel=hem.crop((left,0,right,14))
        panel=panel.resize((right-left,14-round(lift*4)),Image.Resampling.NEAREST)
        frame.alpha_composite(panel,(25+left,60))
    frame.alpha_composite(fixed)
    # Eliminate invisible RGB; retain actual alpha rather than baking a matte.
    frame.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in frame.getdata()])
    frame.save(SOURCE / f'walk-{i+1:02}.png', optimize=True)
    frames.append(frame)
    keys.append({'frame':i+1,'feet':foot_keys,'hemSway':round(sway,3)})

(SOURCE/'walk-keys.json').write_text(json.dumps({'fps':16,'size':[80,88],'pivot':[.5,.125],'keys':keys},indent=2))

preview = Image.new('RGBA', (4*240, 3*264), '#13152b')
for i, frame in enumerate(frames):
    preview.alpha_composite(frame.resize((240,264), Image.Resampling.NEAREST), ((i%4)*240,(i//4)*264))
preview.convert('RGB').save(SOURCE / 'walk-contact-sheet.png')
gif=[]
for frame in frames:
    bg=Image.new('RGBA',frame.size,'#13152b');bg.alpha_composite(frame)
    gif.append(bg.convert('RGB').resize((240,264),Image.Resampling.NEAREST))
gif[0].save(SOURCE / 'walk-preview.gif', save_all=True, append_images=gif[1:], duration=[60,60,60,70]*3, loop=0)
print(json.dumps({'frames':len(frames),'size':[80,88],'sourceSize':list(sheet.size),'unique':len({f.tobytes() for f in frames})}))
