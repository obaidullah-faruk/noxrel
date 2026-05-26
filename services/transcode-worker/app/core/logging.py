import logging
import sys

import structlog

from app.core import config


def configure() -> None:
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        _add_service_name,
    ]

    renderer = structlog.dev.ConsoleRenderer() if config.DEBUG else structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(getattr(logging, config.LOG_LEVEL.upper(), logging.INFO))


def _add_service_name(logger, method_name, event_dict):  # noqa: ANN001
    event_dict.setdefault("service", config.SERVICE_NAME)
    return event_dict


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
