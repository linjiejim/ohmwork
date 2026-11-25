"""Build a lesson film's sound and timing from its film.json.

  set -a; source ~/.config/letpot-film/minimax.env; set +a
  python3 scripts/films/build.py src/films/basics/ohms-law

Reads   <dir>/film.json    voice settings, the narration lines with their beats, the sound effects
Writes  <dir>/audio.mp3    voice + effects, -16 LUFS, mono
        <dir>/timing.json  when each line, caption and beat happens; the animation is keyed to this

Lines are cached in .cache/films by their text and voice settings, so only changed lines are
paid for. A beat is a moment inside a line, named by the words it falls on ("电流") or by an
offset in seconds; it is placed by the pauses MiniMax leaves at commas, then by character
position inside the clause.
"""
import hashlib, json, os, re, subprocess, sys, wave
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import sfx as fx  # noqa: E402

SR = fx.SR
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, ".cache", "films")
PUNCT = "，、：；。！？,.;:!?"
SENTENCE_END = "。！？!?"


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def rms_db(x, hop=0.01):
    h = int(SR * hop)
    n = len(x) // h
    r = np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(r)


def trim(x, floor=-45, head=0.03, tail=0.08):
    db = rms_db(x)
    on = np.nonzero(db > floor)[0]
    if not len(on):
        return x
    a = max(0, int((on[0] * 0.01 - head) * SR))
    b = min(len(x), int(((on[-1] + 1) * 0.01 + tail) * SR))
    return x[a:b]


def pauses(x, floor=-38, min_len=0.08):
    """Silent runs inside the speech: [(start, end)] in seconds, longest first."""
    db = rms_db(x)
    quiet = db < floor
    runs, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if i > 0 and j < len(quiet) and (j - i) * 0.01 >= min_len:
                runs.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return sorted(runs, key=lambda r: r[0] - r[1])


def clauses(text, x):
    """Split the line at internal punctuation and time each clause by the pauses found in the audio."""
    dur = len(x) / SR
    parts, start = [], 0
    for i, ch in enumerate(text):
        if ch in PUNCT:
            parts.append((start, i + 1))
            start = i + 1
    if start < len(text):
        parts.append((start, len(text)))
    cuts = len(parts) - 1
    found = sorted(pauses(x)[:cuts])
    spoken = [sum(1 for c in text[a:b] if c not in PUNCT and not c.isspace()) for a, b in parts]
    if len(found) == cuts:
        bounds = [0.0] + [p for pair in found for p in pair] + [dur]
        times = [(bounds[2 * k], bounds[2 * k + 1]) for k in range(len(parts))]
    else:  # fall back to character proportion
        print(f"  ! {len(found)} pauses for {cuts} commas, timing by characters: {text}")
        total, acc, times = sum(spoken) or 1, 0, []
        for s in spoken:
            times.append((dur * acc / total, dur * (acc + s) / total))
            acc += s
    return [{"a": a, "b": b, "t0": t0, "t1": t1, "n": n} for (a, b), (t0, t1), n in zip(parts, times, spoken)]


def time_of(cl, idx):
    """When the character at `idx` is spoken, inside its clause."""
    for c in cl:
        if c["a"] <= idx < c["b"]:
            done = idx - c["a"]
            return c["t0"] + (c["t1"] - c["t0"]) * min(1, done / max(1, c["n"]))
    return cl[-1]["t1"]


def line_audio(line, film):
    v = {k: film.get(k) for k in ("voice", "speed", "pitch", "emotion")}
    v["speed"] = line.get("speed", v["speed"] or 1.0)
    key = hashlib.sha1(json.dumps([line["text"], v], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    path = os.path.join(CACHE, key + ".mp3")
    if not os.path.exists(path):
        import minimax
        os.makedirs(CACHE, exist_ok=True)
        d = minimax.synth(line["text"], v["voice"], path, v["speed"], v["pitch"] or 0, v["emotion"])
        print(f"  synth {d:.2f}s  {line['text']}")
    return trim(decode(path))


def build(d):
    film = json.load(open(os.path.join(d, "film.json"), encoding="utf-8"))
    gap = film.get("gap", 0.45)
    t = film.get("lead", 0.8)
    voice_parts, lines, beats, captions = [], [], {}, []
    for line in film["lines"]:
        x = line_audio(line, film)
        dur = len(x) / SR
        cl = clauses(line["text"], x)
        start = t
        voice_parts.append((start, x))
        if line["id"] in beats:
            sys.exit(f"'{line['id']}' is used twice: line ids and beat names share one namespace")
        lines.append({"id": line["id"], "text": line["text"], "start": round(start, 3), "end": round(start + dur, 3)})
        beats[line["id"]] = round(start, 3)
        cursor = 0
        for name, at in (line.get("beats") or {}).items():
            if isinstance(at, (int, float)):
                bt = at
            else:
                idx = line["text"].find(at, cursor)
                if idx < 0:
                    sys.exit(f"beat {name}: '{at}' not found in '{line['text']}' after position {cursor}")
                cursor = idx + len(at)
                bt = time_of(cl, idx)
            if name in beats:
                sys.exit(f"beat '{name}' is used twice: line ids and beat names share one namespace")
            beats[name] = round(start + bt, 3)
        # one caption per sentence, so a two-sentence line doesn't sit on screen as a paragraph.
        # "caption" is what the screen shows when it differs from what is said (digits and units: 5 V, 1 kΩ)
        shown = re.findall(r"[^。！？!?]+[。！？!?]?", line.get("caption", line["text"]))
        spans, sent_start = [], 0
        for c in cl:
            if line["text"][c["b"] - 1] in SENTENCE_END or c is cl[-1]:
                first = next(k for k in cl if k["a"] == sent_start)
                spans.append((start + first["t0"], start + c["t1"], line["text"][sent_start:c["b"]].strip()))
                sent_start = c["b"]
        if len(shown) != len(spans):
            spans, shown = [(spans[0][0], spans[-1][1], "")], ["".join(shown)]
        for (a, b, _), text in zip(spans, shown):
            captions.append({"start": round(a, 3), "end": round(b, 3), "text": text.strip()})
        t = start + dur + line.get("gapAfter", gap)
    total = t - gap + film.get("tail", 1.5) if film["lines"] else t
    n = int(total * SR) + SR

    voice = np.zeros(n)
    for start, x in voice_parts:
        a = int(start * SR)
        voice[a:a + len(x)] += x

    dry = np.zeros(n)
    send = np.zeros(n)
    for e in film.get("sfx", []):
        at = e["at"]
        base = beats.get(at)
        if base is None:
            sys.exit(f"sfx at '{at}': no such beat or line")
        when = base + e.get("offset", 0)
        params = {k: v for k, v in e.items() if k not in ("at", "offset", "kind", "gain", "send")}
        s = fx.KINDS[e["kind"]](**params) * e.get("gain", 0.2)
        a = int(when * SR)
        dry[a:a + len(s)] += s[: n - a]
        send[a:a + len(s)] += s[: n - a] * e.get("send", 0.4)
    effects = dry + fx.room(send) * 0.8
    mix = voice * 0.9 + effects
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix[: int(total * SR)]

    # one temp file per film: several films may be built at once
    tmp = os.path.join(CACHE, "mix-" + hashlib.sha1(d.encode()).hexdigest()[:10] + ".wav")
    os.makedirs(CACHE, exist_ok=True)
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    out = os.path.join(d, "audio.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100",
                    "-ac", "1", "-b:a", "64k", out], check=True)
    os.remove(tmp)
    timing = {"duration": round(total, 3), "lines": lines, "beats": beats, "captions": captions}
    json.dump(timing, open(os.path.join(d, "timing.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{out}: {total:.1f}s, {os.path.getsize(out) // 1024} KB, {len(lines)} lines, {len(beats)} beats")


if __name__ == "__main__":
    for d in sys.argv[1:]:
        build(os.path.abspath(d))
