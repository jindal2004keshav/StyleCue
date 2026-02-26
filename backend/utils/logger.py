"""Central logging configuration and logger factory."""

from __future__ import annotations

import logging
import os
import sys

_CONFIGURED = False


def _resolve_level(level_name: str | None) -> int:
    if not level_name:
        return logging.INFO
    resolved = logging.getLevelName(level_name.upper())
    return resolved if isinstance(resolved, int) else logging.INFO


def configure_logging(level_name: str | None = None) -> None:
    """Configure root logging with a StreamHandler (stdout) once."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
        )
        handler.setFormatter(formatter)
        root.addHandler(handler)

    root.setLevel(_resolve_level(level_name or os.getenv("LOG_LEVEL")))
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a module logger after ensuring base config is set."""
    configure_logging()
    return logging.getLogger(name)
