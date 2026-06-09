"""In-process job scheduler.

APScheduler runs inside the FastAPI event loop — no separate worker/beat
process, no broker. Replica-safety comes from the Postgres advisory lock each
job takes (see tasks.py), so this is safe to run with multiple API replicas.
Identical behaviour under Docker Compose and Kubernetes.
"""

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.jobs.tasks import expire_trials, publish_daily_stats

logger = structlog.get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        expire_trials,
        CronTrigger(hour=0, minute=0),
        id="expire_trials",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        publish_daily_stats,
        CronTrigger(hour=1, minute=0),
        id="publish_daily_stats",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("scheduler_started", jobs=["expire_trials", "publish_daily_stats"])
    return scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("scheduler_stopped")
