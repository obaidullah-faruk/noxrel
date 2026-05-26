"""Tests for FFmpeg helpers — unit-level, no real FFmpeg required."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.transcoder.ffmpeg import _double_bitrate, write_master_manifest
from app.transcoder.profiles import QUALITY_PROFILES


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


class TestProbeDuration:
    @patch("app.transcoder.ffmpeg.subprocess.run")
    def test_returns_float(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="123.45\n")
        from app.transcoder.ffmpeg import probe_duration

        assert probe_duration(Path("fake.mp4")) == pytest.approx(123.45)

    @patch("app.transcoder.ffmpeg.subprocess.run")
    def test_returns_none_on_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        from app.transcoder.ffmpeg import probe_duration

        assert probe_duration(Path("fake.mp4")) is None
