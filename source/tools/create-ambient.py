"""Original tiny looping ambience. Standard library only; source assets remain reproducible."""
from pathlib import Path
import wave, math, struct

target = Path(__file__).resolve().parents[1] / 'assets/art/audio-source/ambient.wav'
target.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(target), 'wb') as stream:
    stream.setnchannels(1)
    stream.setsampwidth(2)
    stream.setframerate(8000)
    samples = []
    for i in range(16000):
        t = i / 8000
        envelope = .65 + .35 * math.cos(math.pi * t)
        value = sum(math.sin(2 * math.pi * frequency * t) * level
                    for frequency, level in [(110, .42), (165, .24), (220, .18), (275, .08)])
        samples.append(struct.pack('<h', round(value * envelope * 3200)))
    stream.writeframes(b''.join(samples))
print(target, target.stat().st_size)
