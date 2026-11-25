"""MiniMax text-to-speech for the lesson films (Chinese voice-over).

The key comes from the environment only (MINIMAX_API_KEY) and is never printed or written anywhere:

  set -a; source ~/.config/letpot-film/minimax.env; set +a
  python3 scripts/films/minimax.py voices                      # Chinese system voices (free call)
  python3 scripts/films/minimax.py say "一句话" --voice ID --out /tmp/a.mp3

build.py imports synth() and caches every line by its text and voice settings, so re-running a
film only pays for the lines that changed.
"""
import argparse, json, os, sys, urllib.error, urllib.request

HOST = "https://api.minimaxi.com"
MODEL = "speech-2.8-hd"


def _key():
    k = os.environ.get("MINIMAX_API_KEY", "").strip()
    if not k:
        sys.exit("MINIMAX_API_KEY not set (set -a; source ~/.config/letpot-film/minimax.env; set +a)")
    return k


def _post(path, body, timeout=300):
    req = urllib.request.Request(HOST + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + _key(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            js = json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"MiniMax HTTP {e.code}")
    except (urllib.error.URLError, TimeoutError):
        sys.exit("MiniMax network request failed")
    code = (js.get("base_resp") or {}).get("status_code", 0)
    if code != 0:
        sys.exit(f"MiniMax status {code}: {(js.get('base_resp') or {}).get('status_msg', '')}")
    return js


def synth(text, voice, out_mp3, speed=1.0, pitch=0, emotion=None, model=MODEL):
    """One line → an mp3 (44.1 kHz mono). Returns the duration MiniMax reports, in seconds."""
    vs = {"voice_id": voice, "speed": speed, "vol": 1, "pitch": pitch}
    if emotion:
        vs["emotion"] = emotion
    body = {"model": model, "text": text, "stream": False, "language_boost": "Chinese", "output_format": "hex",
            "voice_setting": vs, "audio_setting": {"sample_rate": 44100, "bitrate": 128000, "format": "mp3", "channel": 1}}
    js = _post("/v1/t2a_v2", body)
    with open(out_mp3, "wb") as f:
        f.write(bytes.fromhex(js["data"]["audio"]))
    return (js.get("extra_info") or {}).get("audio_length", 0) / 1000


def _voices(a):
    js = _post("/v1/get_voice", {"voice_type": "system"})
    for v in js.get("system_voice") or []:
        vid = v.get("voice_id", "")
        desc = "; ".join(v.get("description") or [])
        if a.all or "Chinese" in vid or not vid[:1].isupper():
            print(vid, "|", v.get("voice_name", ""), "|", desc)


def _say(a):
    d = synth(a.text, a.voice, a.out, a.speed, a.pitch, a.emotion)
    print(f"{d:.2f}s → {a.out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("voices"); p.add_argument("--all", action="store_true"); p.set_defaults(f=_voices)
    p = sp.add_parser("say"); p.add_argument("text"); p.add_argument("--voice", required=True); p.add_argument("--out", required=True)
    p.add_argument("--speed", type=float, default=1.0); p.add_argument("--pitch", type=int, default=0); p.add_argument("--emotion")
    p.set_defaults(f=_say)
    a = ap.parse_args()
    a.f(a)
