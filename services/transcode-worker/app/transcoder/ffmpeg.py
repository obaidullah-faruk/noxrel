"""FFmpeg wrappers for HLS transcoding and thumbnail extraction."""

import subprocess
from pathlib import Path

import structlog

from app.core import config
from app.transcoder.profiles import QualityProfile

logger = structlog.get_logger(__name__)


def _run(cmd: list[str], label: str) -> None:
    logger.info("ffmpeg_start", label=label, cmd=" ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("ffmpeg_failed", label=label, stderr=result.stderr[-2000:])
        raise RuntimeError(f"FFmpeg failed [{label}]: {result.stderr[-500:]}")
    logger.info("ffmpeg_done", label=label)


def transcode_hls(input_path: Path, output_dir: Path, profile: QualityProfile) -> Path:
    """Transcode input to HLS for a single quality profile. Returns path to the index.m3u8."""
    quality_dir = output_dir / profile.name
    quality_dir.mkdir(parents=True, exist_ok=True)

    manifest = quality_dir / "index.m3u8"
    maxrate = profile.video_bitrate
    bufsize = _double_bitrate(profile.video_bitrate)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-vf",
        f"scale={profile.width}:{profile.height}",
        "-c:v",
        "libx264",
        "-preset",
        config.FFMPEG_PRESET,
        "-crf",
        str(config.FFMPEG_CRF),
        "-b:v",
        profile.video_bitrate,
        "-maxrate",
        maxrate,
        "-bufsize",
        bufsize,
        "-c:a",
        "aac",
        "-b:a",
        profile.audio_bitrate,
        "-ar",
        "48000",
        "-hls_time",
        str(config.HLS_SEGMENT_DURATION),
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        str(quality_dir / "%03d.ts"),
        "-hls_flags",
        "independent_segments",
        str(manifest),
    ]
    _run(cmd, label=f"hls_{profile.name}")
    return manifest


def write_master_manifest(output_dir: Path, profiles: list[QualityProfile]) -> Path:
    """Generate master.m3u8 referencing each quality variant."""
    lines = ["#EXTM3U", "#EXT-X-VERSION:3", ""]
    for p in profiles:
        lines.append(f'#EXT-X-STREAM-INF:BANDWIDTH={p.bandwidth},RESOLUTION={p.width}x{p.height},CODECS="{p.codecs}"')
        lines.append(f"{p.name}/index.m3u8")
        lines.append("")

    master = output_dir / "master.m3u8"
    master.write_text("\n".join(lines))
    return master


def extract_thumbnail(input_path: Path, output_dir: Path) -> Path:
    """Extract poster frame at t=10s. Returns path to thumb_poster.jpg."""
    output_dir.mkdir(parents=True, exist_ok=True)
    poster = output_dir / "thumb_poster.jpg"
    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        "10",
        "-i",
        str(input_path),
        "-vframes",
        "1",
        "-q:v",
        "2",
        str(poster),
    ]
    _run(cmd, label="thumbnail_poster")
    return poster


def extract_sprite(input_path: Path, output_dir: Path) -> Path:
    """Extract sprite sheet (every 10s, 160x90 tiles) for scrub preview."""
    output_dir.mkdir(parents=True, exist_ok=True)
    sprite = output_dir / "sprite.jpg"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-vf",
        "fps=1/10,scale=160:90,tile=10x10",
        str(sprite),
    ]
    _run(cmd, label="thumbnail_sprite")
    return sprite


def probe_duration(input_path: Path) -> float | None:
    """Return video duration in seconds using ffprobe, or None on failure."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(input_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        try:
            return float(result.stdout.strip())
        except ValueError:
            pass
    return None


def _double_bitrate(bitrate: str) -> str:
    """Return 2× the given bitrate string (e.g. '2500k' → '5000k')."""
    if bitrate.endswith("k"):
        return f"{int(bitrate[:-1]) * 2}k"
    if bitrate.endswith("m"):
        return f"{int(bitrate[:-1]) * 2}m"
    return str(int(bitrate) * 2)
