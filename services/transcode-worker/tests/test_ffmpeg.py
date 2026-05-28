"""Tests for FFmpeg helpers — unit-level, no real FFmpeg required."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.transcoder.ffmpeg import _double_bitrate, probe_video_info, write_master_manifest
from app.transcoder.profiles import QUALITY_PROFILES, select_profiles


class TestDoubleBitrate:
    def test_kilobits(self):
        assert _double_bitrate("2500k") == "5000k"

    def test_megabits(self):
        assert _double_bitrate("2m") == "4m"

    def test_raw_int(self):
        assert _double_bitrate("1000") == "2000"

    def test_400k(self):
        assert _double_bitrate("400k") == "800k"


class TestWriteMasterManifest:
    def test_creates_file(self, tmp_path: Path):
        manifest = write_master_manifest(tmp_path, QUALITY_PROFILES)
        assert manifest.exists()
        content = manifest.read_text()
        assert "#EXTM3U" in content
        assert "240p/index.m3u8" in content
        assert "1080p/index.m3u8" in content

    def test_bandwidth_present(self, tmp_path: Path):
        manifest = write_master_manifest(tmp_path, QUALITY_PROFILES)
        content = manifest.read_text()
        assert "BANDWIDTH=400000" in content
        assert "BANDWIDTH=5000000" in content

    def test_resolution_present(self, tmp_path: Path):
        manifest = write_master_manifest(tmp_path, QUALITY_PROFILES)
        content = manifest.read_text()
        assert "RESOLUTION=1280x720" in content


class TestTranscodeHLS:
    @patch("app.transcoder.ffmpeg.subprocess.run")
    def test_calls_ffmpeg(self, mock_run, tmp_path: Path):
        mock_run.return_value = MagicMock(returncode=0, stderr="")
        from app.transcoder.ffmpeg import transcode_hls
        from app.transcoder.profiles import QUALITY_PROFILES

        profile = QUALITY_PROFILES[0]  # 240p
        input_path = tmp_path / "input.mp4"
        input_path.write_bytes(b"fake")

        transcode_hls(input_path, tmp_path / "output", profile)

        mock_run.assert_called_once()
        cmd = mock_run.call_args[0][0]
        assert "ffmpeg" in cmd
        assert "scale=426:240" in " ".join(cmd)

    @patch("app.transcoder.ffmpeg.subprocess.run")
    def test_raises_on_ffmpeg_failure(self, mock_run, tmp_path: Path):
        mock_run.return_value = MagicMock(returncode=1, stderr="some ffmpeg error")
        from app.transcoder.ffmpeg import transcode_hls
        from app.transcoder.profiles import QUALITY_PROFILES

        profile = QUALITY_PROFILES[1]
        input_path = tmp_path / "input.mp4"
        input_path.write_bytes(b"fake")

        with pytest.raises(RuntimeError, match="FFmpeg failed"):
            transcode_hls(input_path, tmp_path / "output", profile)


class TestProbeVideoInfo:
    @patch("app.transcoder.ffmpeg.subprocess.run")
    def test_returns_duration_and_height(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="1080\n120.5\n")
        duration, height = probe_video_info(Path("fake.mp4"))
        assert height == 1080
        assert duration == pytest.approx(120.5)

    @patch("app.transcoder.ffmpeg.subprocess.run")
    def test_returns_nones_on_ffprobe_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        duration, height = probe_video_info(Path("fake.mp4"))
        assert duration is None
        assert height is None

    @patch("app.transcoder.ffmpeg.subprocess.run")
    def test_tolerates_na_values(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="N/A\nN/A\n")
        duration, height = probe_video_info(Path("fake.mp4"))
        assert duration is None
        assert height is None


class TestSelectProfiles:
    def test_480p_source_excludes_higher(self):
        profiles = select_profiles(480)
        names = [p.name for p in profiles]
        assert names == ["240p", "480p"]

    def test_720p_source(self):
        profiles = select_profiles(720)
        names = [p.name for p in profiles]
        assert names == ["240p", "480p", "720p"]

    def test_1080p_source(self):
        profiles = select_profiles(1080)
        names = [p.name for p in profiles]
        assert names == ["240p", "480p", "720p", "1080p"]

    def test_4k_source_includes_all(self):
        profiles = select_profiles(2160)
        assert len(profiles) == len(QUALITY_PROFILES)

    def test_none_source_returns_all(self):
        profiles = select_profiles(None)
        assert profiles == QUALITY_PROFILES

    def test_very_low_resolution_falls_back_to_minimum(self):
        profiles = select_profiles(100)
        assert len(profiles) == 1
        assert profiles[0].name == "240p"
