"""Periodic source sync: the platform "waits for data" by polling every enabled source.

While the library is empty the scheduler polls every minute so new data is picked up quickly; once data is
present it falls back to SYNC_INTERVAL_SECONDS. A DB lease lock elects one scheduler across replicas.
"""

from __future__ import annotations

import logging
import os
import socket
import threading
from datetime import timedelta

log = logging.getLogger(__name__)


class SyncScheduler:
    def __init__(self, container) -> None:
        self.container = container
        self.settings = container.settings
        self.owner = f"{socket.gethostname()}:{os.getpid()}"
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self.settings.sync_interval_seconds <= 0 or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="sync-scheduler", daemon=True)
        self._thread.start()
        log.info("sync scheduler started (interval %ss)", self.settings.sync_interval_seconds)

    def stop(self) -> None:
        self._stop.set()

    def _interval(self) -> int:
        try:
            empty = self.container.store.count() == 0
        except Exception:
            empty = True
        return min(60, self.settings.sync_interval_seconds) if empty else self.settings.sync_interval_seconds

    def _loop(self) -> None:
        self._stop.wait(3)  # let the app finish starting
        while not self._stop.is_set():
            interval = self._interval()
            try:
                self.tick(interval)
            except Exception:
                log.exception("scheduler tick failed")
            self._stop.wait(interval)

    def tick(self, interval: int | None = None) -> bool:
        interval = interval or self.settings.sync_interval_seconds
        jobs = self.container.jobs
        jobs.recover_stale()
        if not jobs.try_lock("scheduler", self.owner, timedelta(seconds=max(90, interval * 2))):
            return False
        if jobs.active("ingest") is not None:
            return False
        jobs.submit("ingest", {"mode": "incremental"}, triggered_by="scheduler")
        return True
