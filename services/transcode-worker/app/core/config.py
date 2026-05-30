from decouple import config

KAFKA_BOOTSTRAP_SERVERS: str = config("KAFKA_BOOTSTRAP_SERVERS", default="localhost:9092")
KAFKA_SECURITY_PROTOCOL: str = config("KAFKA_SECURITY_PROTOCOL", default="PLAINTEXT")
KAFKA_CONSUMER_GROUP: str = config("KAFKA_CONSUMER_GROUP", default="transcode-worker")
KAFKA_TOPIC_VIDEO_UPLOADED: str = config("KAFKA_TOPIC_VIDEO_UPLOADED", default="video.uploaded")
KAFKA_TOPIC_VIDEO_TRANSCODED: str = config("KAFKA_TOPIC_VIDEO_TRANSCODED", default="video.transcoded")
KAFKA_TOPIC_VIDEO_TRANSCODE_FAILED: str = config("KAFKA_TOPIC_VIDEO_TRANSCODE_FAILED", default="video.transcode_failed")
KAFKA_TOPIC_DLQ: str = config("KAFKA_TOPIC_DLQ", default="video.uploaded.dlq")

AWS_REGION: str = config("AWS_REGION", default="us-east-1")
AWS_ACCESS_KEY_ID: str = config("AWS_ACCESS_KEY_ID", default="test")
AWS_SECRET_ACCESS_KEY: str = config("AWS_SECRET_ACCESS_KEY", default="test")
AWS_S3_ENDPOINT_URL: str = config("AWS_S3_ENDPOINT_URL", default="")

S3_RAW_BUCKET: str = config("S3_RAW_BUCKET", default="raw-videos")
S3_TRANSCODED_BUCKET: str = config("S3_TRANSCODED_BUCKET", default="transcoded-videos")
S3_THUMBNAIL_BUCKET: str = config("S3_THUMBNAIL_BUCKET", default="thumbnails")

CLOUDFRONT_BASE_URL: str = config("CLOUDFRONT_BASE_URL", default="")

DEBUG: bool = config("DEBUG", default=False, cast=bool)
LOG_LEVEL: str = config("LOG_LEVEL", default="INFO")
SERVICE_NAME: str = "transcode-worker"
OTEL_EXPORTER_OTLP_ENDPOINT: str = config("OTEL_EXPORTER_OTLP_ENDPOINT", default="http://otel-collector:4317")
LIVENESS_FILE: str = config("LIVENESS_FILE", default="/tmp/worker_alive")

FFMPEG_PRESET: str = config("FFMPEG_PRESET", default="fast")
FFMPEG_CRF: int = config("FFMPEG_CRF", default=23, cast=int)
HLS_SEGMENT_DURATION: int = config("HLS_SEGMENT_DURATION", default=6, cast=int)

TRANSCODE_MAX_RETRIES: int = config("TRANSCODE_MAX_RETRIES", default=3, cast=int)
