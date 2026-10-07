"""Build the silent hero loop and poster from the local, untracked source.

Run: python tools/optimize_hero_video.py --ffmpeg path/to/ffmpeg
The original is preserved; only public/videos/hero-loop.* and hero-poster.jpg
are replaced. The first ten seconds are used, with the outer game HUD cropped
away. A 0.6-second wrap dissolve joins the end to the beginning.
"""
import argparse
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--ffmpeg", "--ffmpeg-path", required=True)
args = parser.parse_args()
encoder = str(Path(args.ffmpeg).resolve())
folder = ROOT / "public/videos"
source = folder / "hero-source.mp4"
if not source.is_file():
    raise SystemExit(f"Missing source: {source}")

graph = (
    "[0:v]crop=2100:900:600:300,fps=30,scale=1440:618:flags=lanczos,setsar=1,split=2[body][head];"
    "[body]trim=start=0.6:end=10,setpts=PTS-STARTPTS,fps=30[b];"
    "[head]trim=start=0:end=0.6,setpts=PTS-STARTPTS,fps=30,"
    "tpad=start_duration=0.6:start_mode=clone[h];"
    "[b][h]xfade=transition=fade:duration=0.6:offset=8.8,format=yuv420p,split=2[webm][mp4]"
)
command = [encoder, "-hide_banner", "-y", "-loglevel", "warning", "-threads", "2",
           "-filter_complex_threads", "2", "-t", "10", "-i", str(source),
           "-filter_complex", graph,
           "-map", "[webm]", "-an", "-c:v", "libvpx-vp9", "-b:v", "900k", "-crf", "38",
           "-maxrate", "1100k", "-bufsize", "1800k",
           "-cpu-used", "4", "-row-mt", "1", "-threads", "4", "-map_metadata", "-1",
           str(folder / "hero-loop.webm"),
           "-map", "[mp4]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
           "-pix_fmt", "yuv420p", "-threads", "4", "-movflags", "+faststart", "-map_metadata", "-1",
           str(folder / "hero-loop.mp4")]
print("Encoding the silent 10-second loop in WebM and MP4...", flush=True)
subprocess.run(command, check=True)
subprocess.run([encoder, "-hide_banner", "-y", "-loglevel", "error", "-i",
                str(folder / "hero-loop.mp4"), "-frames:v", "1", "-q:v", "2",
                "-update", "1", str(folder / "hero-poster.jpg")], check=True)
for name in ("hero-loop.webm", "hero-loop.mp4", "hero-poster.jpg"):
    asset = folder / name
    print(f"{name}: {asset.stat().st_size:,} bytes", flush=True)
