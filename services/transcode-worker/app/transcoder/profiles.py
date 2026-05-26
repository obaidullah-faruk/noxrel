from dataclasses import dataclass


@dataclass(frozen=True)
class QualityProfile:
    name: str
    width: int
    height: int
    video_bitrate: str
    audio_bitrate: str
    bandwidth: int  # bits/s for HLS EXT-X-STREAM-INF
    codecs: str = "avc1.42e01e,mp4a.40.2"


QUALITY_PROFILES: list[QualityProfile] = [
    QualityProfile("240p", 426, 240, "400k", "64k", 400_000, "avc1.42e00a,mp4a.40.2"),
    QualityProfile("480p", 854, 480, "1000k", "128k", 1_000_000),
    QualityProfile("720p", 1280, 720, "2500k", "128k", 2_500_000, "avc1.4d401f,mp4a.40.2"),
    QualityProfile("1080p", 1920, 1080, "5000k", "192k", 5_000_000, "avc1.640028,mp4a.40.2"),
    QualityProfile("4K", 3840, 2160, "15000k", "192k", 15_000_000, "avc1.640033,mp4a.40.2"),
]
