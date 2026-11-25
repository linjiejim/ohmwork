"""Sound effects for the lesson films, synthesised with numpy (no samples, nothing to license).

A few materials that share one small room, so they sound like one film rather than beeps on
top of a voice. Every function returns a mono float array at SR; gains are set when placing.

  glass(f)          a small struck tone: a value lands, a formula clicks into place
  knock(f)          a muted wooden knock: an item appears, a number ticks over
  air(dur, f0, f1)  a soft whoosh: one scene hands over to the next
  thump(f)          a felt low hit, used once for the title
"""
import numpy as np

SR = 48000
_rng = np.random.default_rng(11)


def _t(n):
    return np.arange(n) / SR


def band(x, centre, width_oct=0.6, lowpass=None):
    """Band-pass by shaping the spectrum: a gaussian bump `width_oct` octaves wide around `centre`."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / centre) / width_oct) ** 2)
    if lowpass:
        g *= 1 / np.sqrt(1 + (f / lowpass) ** 4)
    return np.fft.irfft(X * g, len(x))


def glass(f, dur=0.9, bright=1.0):
    n = int(SR * dur)
    t = _t(n)
    tone = (np.sin(2 * np.pi * f * t) * np.exp(-t * 6)
            + 0.32 * bright * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 15)
            + 0.14 * bright * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 26))
    hit = band(_rng.standard_normal(n), 4500, 0.8) * np.exp(-t * 260) * 0.6
    s = tone * 0.75 + hit
    return s / np.abs(s).max()


def knock(f=210, dur=0.14):
    n = int(SR * dur)
    t = _t(n)
    body = np.sin(2 * np.pi * f * t * (1 + 0.35 * np.exp(-t * 80))) * np.exp(-t * 55)
    snap = band(_rng.standard_normal(n), 3000, 0.5) * np.exp(-t * 400)
    s = body + snap * 0.45
    return s / np.abs(s).max()


def air(dur=0.5, f0=300, f1=2400, peak=0.5):
    n = int(SR * dur)
    x = _rng.standard_normal(n)
    out = np.zeros(n)
    blocks = 20
    size = n // blocks + 1
    win = 600
    for i in range(blocks):
        a, b = i * size, min(n, (i + 1) * size)
        if a >= b:
            break
        centre = f0 * (f1 / f0) ** (i / (blocks - 1))
        lo = max(0, a - win)
        seg = band(x[lo:b], centre, 0.7, lowpass=6000)
        out[a:b] = seg[a - lo:]
    u = _t(n) / dur
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.5 * np.where(u < peak, u / peak, 1)
    s = out * env
    return s / np.abs(s).max()


def thump(f=58, dur=0.8):
    n = int(SR * dur)
    t = _t(n)
    phase = np.cumsum(2 * np.pi * (f + f * 2.0 * np.exp(-t * 30)) / SR)
    s = np.sin(phase) * np.exp(-t * 5)
    s = np.tanh(s * 1.8) / np.tanh(1.8)
    return s / np.abs(s).max()


KINDS = {"glass": glass, "knock": knock, "air": air, "thump": thump}


def room(dry, t60=0.9, predelay=0.012):
    """One shared small room: an exponentially decaying, darkened noise tail, convolved by FFT."""
    n = int(SR * t60 * 1.2)
    t = _t(n)
    ir = _rng.standard_normal(n) * np.exp(-t * 6.9 / t60)
    ir = band(ir, 1200, 1.6, lowpass=5000)
    ir = np.concatenate([np.zeros(int(SR * predelay)), ir])
    ir /= np.sqrt((ir ** 2).sum())
    m = len(dry) + len(ir) - 1
    size = 1 << (m - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(dry, size) * np.fft.rfft(ir, size), size)[: len(dry)]
    return wet
