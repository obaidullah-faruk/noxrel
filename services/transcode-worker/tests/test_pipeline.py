"""Integration-level tests for the transcode pipeline (all I/O mocked)."""

from unittest.mock import patch

import pytest

SAMPLE_EVENT = {
    "video_id": "aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa",
    "uploader_id": "bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb",
    "s3_bucket": "raw-videos",
    "s3_key": "raw/uploads/aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa/original",
    "raw_file_size_bytes": 5_000_000,
    "title": "Pipeline Test",
}


@patch("app.transcoder.pipeline.kafka.flush")
@patch("app.transcoder.pipeline.kafka.publish")
@patch("app.transcoder.pipeline.s3.upload_directory", return_value=["vid/master.m3u8"])
@patch("app.transcoder.pipeline.ffmpeg.extract_sprite")
@patch("app.transcoder.pipeline.ffmpeg.extract_thumbnail")
@patch("app.transcoder.pipeline.ffmpeg.write_master_manifest")
@patch("app.transcoder.pipeline.ffmpeg.transcode_hls")
@patch("app.transcoder.pipeline.ffmpeg.probe_duration", return_value=120.5)
@patch("app.transcoder.pipeline.s3.download_file")
def test_run_happy_path(
    mock_download,
    mock_probe,
    mock_hls,
    mock_manifest,
    mock_thumb,
    mock_sprite,
    mock_upload_dir,
    mock_publish,
    mock_flush,
):
    from app.transcoder.pipeline import run

    run(SAMPLE_EVENT)

    mock_download.assert_called_once()
    mock_probe.assert_called_once()
    assert mock_hls.call_count == 5  # one per quality profile
    mock_manifest.assert_called_once()
    mock_thumb.assert_called_once()
    mock_sprite.assert_called_once()
    mock_upload_dir.assert_called_once()

    mock_publish.assert_called_once()
    published_payload = mock_publish.call_args[1]["payload"]
    assert published_payload["video_id"] == SAMPLE_EVENT["video_id"]
    assert published_payload["duration_seconds"] == 120.5
    assert "240p" in published_payload["available_qualities"]
    mock_flush.assert_called_once()


@patch("app.transcoder.pipeline.kafka.flush")
@patch("app.transcoder.pipeline.kafka.publish")
@patch("app.transcoder.pipeline.s3.download_file", side_effect=Exception("S3 error"))
def test_run_with_retry_publishes_failure(mock_download, mock_publish, mock_flush):
    from app.transcoder.pipeline import run_with_retry

    with pytest.raises(Exception, match="S3 error"):
        run_with_retry(SAMPLE_EVENT)

    from app.core import config

    failure_calls = [c for c in mock_publish.call_args_list if config.KAFKA_TOPIC_VIDEO_TRANSCODE_FAILED in str(c)]
    dlq_calls = [c for c in mock_publish.call_args_list if config.KAFKA_TOPIC_DLQ in str(c)]
    assert len(failure_calls) >= 1
    assert len(dlq_calls) >= 1


@patch("app.transcoder.pipeline.kafka.flush")
@patch("app.transcoder.pipeline.kafka.publish")
@patch("app.transcoder.pipeline.s3.upload_directory", return_value=[])
@patch("app.transcoder.pipeline.ffmpeg.extract_sprite", side_effect=Exception("sprite fail"))
@patch("app.transcoder.pipeline.ffmpeg.extract_thumbnail")
@patch("app.transcoder.pipeline.ffmpeg.write_master_manifest")
@patch("app.transcoder.pipeline.ffmpeg.transcode_hls")
@patch("app.transcoder.pipeline.ffmpeg.probe_duration", return_value=60.0)
@patch("app.transcoder.pipeline.s3.download_file")
def test_thumbnail_failure_does_not_abort_pipeline(
    mock_download,
    mock_probe,
    mock_hls,
    mock_manifest,
    mock_thumb,
    mock_sprite,
    mock_upload_dir,
    mock_publish,
    mock_flush,
):
    """Thumbnail extraction failure should be swallowed — pipeline still succeeds."""
    from app.transcoder.pipeline import run

    run(SAMPLE_EVENT)  # should not raise

    mock_publish.assert_called_once()  # video.transcoded still published
