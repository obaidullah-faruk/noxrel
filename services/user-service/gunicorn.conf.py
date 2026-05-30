import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

bind = "0.0.0.0:8000"
workers = 4
timeout = 60
accesslog = "-"


def post_fork(server, worker):
    from core.telemetry import setup_telemetry

    setup_telemetry()
