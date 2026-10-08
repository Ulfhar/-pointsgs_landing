# Homepage hero media

The homepage uses `hero-loop.webm` as its VP9 source, `hero-loop.mp4` as its H.264 fallback, and `hero-poster.jpg` before playback or when the video is disabled. Both video files contain the same silent loop; mobile uses the same clip with a CSS crop.

| Asset | Format | Dimensions | Duration / frame rate | Size |
| --- | --- | --- | --- | --- |
| `hero-loop.webm` | VP9 Profile 0, YUV420p | 1440 × 618 | 10.0 s / 30 fps | 1,147,341 bytes |
| `hero-loop.mp4` | H.264 High, YUV420p, faststart | 1440 × 618 | 10.0 s / 30 fps | 1,352,505 bytes |
| `hero-poster.jpg` | JPEG | 1440 × 618 | First frame of the optimized MP4 | 154,746 bytes |

## Rebuild

Place the original recording at `public/videos/hero-source.mp4`, then run from the repository root:

```powershell
python tools/optimize_hero_video.py --ffmpeg ".tmp/hero-media-tools/extracted/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
```

`--ffmpeg-path` is an equivalent argument. A different FFmpeg executable can be used if it includes `libvpx-vp9` and `libx264`. The current portable executable is FFmpeg 7.1 from the `imageio-ffmpeg` 0.6.0 Windows wheel. The script does not install software or alter the recording; it replaces the three derived assets above.

Only source 0–10 seconds is used. `crop=2100:900:600:300` selects a 2100 × 900 region starting at source coordinates (600, 300), excluding the outer game HUD. The clip is resampled to 30 fps and scaled to 1440 × 618 with Lanczos.

The body contains source 0.6–10 seconds (9.4 seconds). The head contains source 0–0.6 seconds with a 0.6-second cloned first frame added by `tpad=start_duration=0.6:start_mode=clone` (1.2 seconds total). `xfade=transition=fade:duration=0.6:offset=8.8` dissolves the body into that held first frame, then plays source 0–0.6 seconds before returning to the body's source 0.6-second starting point. This produces exactly 10 seconds and 300 frames without changing the remaining footage's playback speed. Sample aspect ratio is 1:1, audio is removed, and container metadata is removed.

- WebM: `libvpx-vp9`, CRF 38, target bitrate `900k`, maximum bitrate `1100k`, buffer `1800k`, `cpu-used=4`, `row-mt=1`, four encoding threads.
- MP4: `libx264`, CRF 25, `veryfast`, YUV420p, four encoding threads, `+faststart`.
- Decoder and filter threads are limited to two. The poster is extracted from output frame zero with JPEG quality parameter `-q:v 2`.

## Original and verification

The source is 541,887,902 bytes: approximately 134.35 seconds, 3120 × 1440, H.264 at approximately 59.56 fps, with mono AAC audio. Its SHA-256 is:

```text
6AFD7A676876F9899D2CF3140B29F37A25D4B5D97DCC5F04EF98FC50FB7AD11E
```

`hero-source.mp4` is ignored by Git because the large editing source is only needed for local rebuilds. The optimized assets are kept with the site for static hosting and are not ignored. Temporary download tools and diagnostic frames live under the ignored `/.tmp/` directory.

Both final cropped videos were independently probed and fully decoded without errors. Each contains one video stream and no audio, at 1440 × 618, 30 fps, exactly 10.0 seconds, and 300 decoded frames. The MP4 `moov` atom at byte 32 precedes `mdat` at byte 4,243, confirming faststart. The JPEG opens at the expected dimensions. Asset byte counts and SHA-256 prefixes match the final encoding; the original recording's byte count and full SHA-256 remain unchanged.

## Press Kit gameplay download

`press-gameplay.mp4` contains the full recording, including its audio, for press and creator downloads. It is also included in `downloads/Lumen-Grove-Press-Media.zip` alongside the 17 original Press Kit images.

| Asset | Format | Dimensions | Duration / frame rate | Size |
| --- | --- | --- | --- | --- |
| `press-gameplay.mp4` | H.264 High, YUV420p, faststart; mono AAC, 44.1 kHz | 1872 × 864 | 134.35 s / 30 fps | 38,837,234 bytes |

This version preserves the recording's full 13:6 frame without cropping. Video uses `libx264` at CRF 23 and audio uses AAC at 128 kbps. The complete video and audio streams were decoded successfully, and the source recording and homepage loops were preserved.
