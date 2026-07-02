import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

bind = "0.0.0.0:8001"
workers = 4
timeout = 60
accesslog = "-"
reload = os.environ.get("DEBUG", "").lower() in ("1", "true", "yes")


def on_starting(server):
    # Clear stale per-worker metric files from a previous run before any worker
    # forks, so prometheus_client starts from a clean multiprocess dir.
    import glob

    multiproc_dir = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
    if multiproc_dir and os.path.isdir(multiproc_dir):
        for db_file in glob.glob(os.path.join(multiproc_dir, "*.db")):
            os.remove(db_file)


def post_fork(server, worker):
    from core.telemetry import setup_telemetry

    setup_telemetry()


def child_exit(server, worker):
    # Clean up a dead worker's metric files so its counters don't linger forever.
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        from prometheus_client import multiprocess

        multiprocess.mark_process_dead(worker.pid)
