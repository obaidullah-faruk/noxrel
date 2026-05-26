"""Tests for S3 helpers using moto."""

import os
from pathlib import Path
from unittest.mock import patch

import boto3
import pytest
from moto import mock_aws

# Ensure no real endpoint is set so moto can intercept
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ["AWS_S3_ENDPOINT_URL"] = ""
os.environ.setdefault("AWS_REGION", "us-east-1")


@pytest.fixture
def s3_bucket(monkeypatch):
    """Start moto S3 mock, clear endpoint override, create a test bucket."""
    monkeypatch.setattr("app.core.s3.config.AWS_S3_ENDPOINT_URL", "")
    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="test-bucket")
        yield "test-bucket"


def test_upload_and_download_roundtrip(tmp_path: Path, s3_bucket: str):
    src = tmp_path / "file.txt"
    src.write_text("hello world")

    from app.core.s3 import download_file, upload_file

    upload_file(src, s3_bucket, "some/key.txt", "text/plain")

    dest = tmp_path / "downloaded.txt"
    download_file(s3_bucket, "some/key.txt", dest)
    assert dest.read_text() == "hello world"


def test_upload_directory(tmp_path: Path, s3_bucket: str):
    d = tmp_path / "hls"
    (d / "240p").mkdir(parents=True)
    (d / "240p" / "index.m3u8").write_text("#EXTM3U")
    (d / "240p" / "segments").mkdir()
    (d / "240p" / "segments" / "000.ts").write_bytes(b"ts")

    from app.core.s3 import upload_directory

    keys = upload_directory(d, s3_bucket, prefix="vid123")
    assert any("index.m3u8" in k for k in keys)
    assert any("000.ts" in k for k in keys)


def test_public_url_localstack():
    with patch("app.core.s3.config") as cfg:
        cfg.CLOUDFRONT_BASE_URL = ""
        cfg.AWS_S3_ENDPOINT_URL = "http://localhost:4566"
        from app.core import s3

        url = s3.public_url("transcoded-videos", "vid123/master.m3u8")
        assert "vid123/master.m3u8" in url


def test_public_url_cloudfront():
    with patch("app.core.s3.config") as cfg:
        cfg.CLOUDFRONT_BASE_URL = "https://cdn.example.com"
        from app.core import s3

        url = s3.public_url("transcoded-videos", "vid123/master.m3u8")
        assert url == "https://cdn.example.com/vid123/master.m3u8"
