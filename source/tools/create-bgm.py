"""Original RuneRampage micro-score, no samples, MIDI, external melodies or runtime dependencies.
Offline requirements: numpy, lameenc==1.9.0. Outputs mono 16 kHz / 16 kbit MP3.
"""
from pathlib import Path
import hashlib
import json
import math
import sys
import wave

import numpy as np

# Optional local development encoder; never copied into the game.
sys.path.insert(0, 'D:/CODEX缓存/rune-audio-dev')
import lameenc

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/resources/audio/music'
EVIDENCE = ROOT / 'docs/boss-aura-bgm/audio'
SR = 16000

# Notes are authored here for this project, expressed as MIDI pitches (not MIDI files).
SCORES = {
    'menu': dict(seconds=6, steps=16, bass=[45, 45, 41, 43],
                 melody=[69, 0, 76, 72, 0, 71, 67, 0, 65, 0, 72, 69, 67, 64, 67, 0], beat=False),
    'battle': dict(seconds=8, steps=32, bass=[45, 41, 43, 40],
                   melody=[69, 72, 76, 72, 67, 71, 74, 71, 65, 69, 72, 76, 67, 64, 71, 67,
                           69, 76, 79, 76, 72, 71, 67, 64, 65, 72, 76, 72, 71, 67, 64, 0], beat=True),
    'boss': dict(seconds=6, steps=32, bass=[33, 34, 33, 40],
                 melody=[57, 0, 64, 58, 57, 0, 60, 64, 58, 57, 0, 64, 65, 64, 58, 0,
                         57, 64, 69, 64, 58, 0, 60, 64, 65, 64, 60, 58, 57, 0, 52, 0], beat=True),
    'shop': dict(seconds=6, steps=16, bass=[48, 45, 41, 43],
                 melody=[72, 76, 79, 0, 76, 72, 69, 0, 65, 69, 72, 0, 67, 71, 74, 0], beat=False),
    'victory': dict(seconds=4, steps=16, bass=[48, 43, 45, 48],
                    melody=[72, 0, 76, 79, 84, 0, 79, 0, 81, 79, 76, 0, 72, 76, 84, 0], beat=True),
}


def note(pitch, length, level, bright=False):
    count = max(2, round(length * SR))
    t = np.arange(count, dtype=np.float64) / SR
    frequency = 440 * 2 ** ((pitch - 69) / 12)
    # Band-limited additive chip voice; avoid harsh square-wave aliasing at 16 kHz.
    voice = np.sin(2 * math.pi * frequency * t)
    if bright:
        for harmonic, gain in [(2, .20), (3, .12), (4, .045)]:
            if frequency * harmonic < SR * .42:
                voice += gain * np.sin(2 * math.pi * frequency * harmonic * t)
    attack = np.minimum(1, t / .012)
    release = np.minimum(1, (length - t) / min(.12, length * .35))
    return voice * attack * np.maximum(0, release) * np.exp(-t * 2.8 / length) * level


def compose(name, score):
    length = score['seconds']
    mix = np.zeros(length * SR, dtype=np.float64)
    step = length / score['steps']

    def add(at, data):
        offset = round(at * SR)
        count = min(len(data), len(mix) - offset)
        mix[offset:offset + count] += data[:count]

    # Restrained rune drone, reusing the project's existing 110-Hz tonal family.
    t = np.arange(len(mix)) / SR
    mix += .018 * np.sin(2 * math.pi * 110 * t) * (1 - np.cos(2 * math.pi * t / length))
    for index, pitch in enumerate(score['melody']):
        if pitch:
            add(index * step, note(pitch, step * .86, .19 if name == 'boss' else .16, True))
    for bar, bass in enumerate(score['bass']):
        start = bar * length / 4
        for beat in range(4):
            at = start + beat * length / 16
            add(at, note(bass + (12 if beat % 2 else 0), length / 18, .22, name == 'boss'))
        # Sparse chord echoes rather than costly samples or long reverb tails.
        for arpeggio in range(4):
            add(start + arpeggio * length / 16, note(bass + [24, 31, 36, 31][arpeggio],
                                                    length / 20, .045, True))
    if score['beat']:
        for index in range(16):
            duration = .095
            tt = np.arange(round(duration * SR)) / SR
            # Entirely synthesized kick, no sampled drum assets.
            kick = np.sin(2 * math.pi * (72 * tt - 160 * tt ** 2)) * np.exp(-tt * 42) * .18
            add(index * length / 16, kick)
    fade = round(SR * .025)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix *= .62 / max(.62, np.max(np.abs(mix)))
    return (mix * 32767).astype('<i2')


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    records = []
    for name, score in SCORES.items():
        pcm = compose(name, score)
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(16)
        encoder.set_in_sample_rate(SR)
        encoder.set_channels(1)
        encoder.set_quality(2)
        encoded = encoder.encode(pcm.tobytes()) + encoder.flush()
        path = OUTPUT / ('bgm_' + name + '.mp3')
        path.write_bytes(encoded)
        with wave.open(str(EVIDENCE / ('bgm_' + name + '.wav')), 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(SR)
            audio.writeframes(pcm.tobytes())
        records.append(dict(scene=name, seconds=score['seconds'], sampleRate=SR, channels=1,
                            bitrate=16000, bytes=len(encoded), sha256=hashlib.sha256(encoded).hexdigest(),
                            peak=float(np.max(np.abs(pcm.astype(np.float64))) / 32768),
                            rms=float(np.sqrt(np.mean((pcm.astype(np.float64) / 32768) ** 2)))))
    (EVIDENCE / 'manifest.json').write_text(json.dumps(records, indent=2), encoding='utf8')
    print(json.dumps(dict(tracks=records, totalBytes=sum(row['bytes'] for row in records)), indent=2))


if __name__ == '__main__':
    main()
