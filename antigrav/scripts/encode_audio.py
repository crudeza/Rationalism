"""Re-encode the game audio from your WAV masters (needs ffmpeg + ffprobe).
Usage: python3 scripts/encode_audio.py /path/to/masters [bitrate]   (default 192k)
Writes audio/{world}_{A,B,C,P}.mp3 and prints the manifest.
A = first 75 s, B = 75 s from the middle, C = last ~75 s, P = 30 s preview from 2:30.
If the durations change, paste the printed JSON into `const TRACKS=` in index.html and m/index.html."""
import json, math, pathlib, subprocess, sys
masters = pathlib.Path(sys.argv[1]); br = sys.argv[2] if len(sys.argv) > 2 else "192k"
out = pathlib.Path(__file__).resolve().parent.parent / "audio"; out.mkdir(exist_ok=True)
T = [("Breaks and some more", "Martin Bellomo", "Martin_Bellomo_-_Breaks_and_some_more_MASTER-2-16441.wav"),
     ("More Acid House", "Martin Bellomo", "Martin_Bellomo_-_More_Acid_House_MASTER-16441.wav"),
     ("Entelequia", "", "Entelequia__MASTER-16441.wav"), ("Ganimedes", "", "Ganimedes_MASTER-16441.wav"),
     ("Antikythera", "SANAVIRON", "SANAVIRON_-_Antikythera.wav"), ("Galega", "SANAVIRON & Mauro Batista", "SANAVIRON__Mauro_Batista_-_Galega.wav")]
man = []
for i, (t, a, f) in enumerate(T):
    src = masters / f
    D = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)]))
    bo = round(D / 2); co = math.floor(D) - 75
    seg = {"A": (0, 75, None), "B": (bo, 75, None), "C": (co, D - co + .5, None), "P": (150, 30, "afade=t=in:d=0.3,afade=t=out:st=29.5:d=0.5")}
    for k, (s, l, af) in seg.items():
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(s), "-t", str(l), "-i", str(src)] + (["-af", af] if af else []) + ["-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", br, str(out / f"{i}_{k}.mp3")]
        subprocess.run(cmd, check=True)
    man.append({"t": t, "a": a, "D": round(D, 2), "o": {"A": 0, "B": bo, "C": co, "P": 150}})
print(json.dumps(man, ensure_ascii=False, separators=(",", ":")))
