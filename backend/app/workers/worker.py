"""Worker process: consumes the Redis queue and runs the sync scheduler.

    QUEUE_BACKEND=rq REDIS_URL=redis://redis:6379/0 python -m app.workers.worker
Scale horizontally: jobs of the same kind are de-duplicated and the scheduler is leader-elected.
"""

from __future__ import annotations

import logging

from app.container import get_container
from app.core.logging import configure_logging
from app.workers.scheduler import SyncScheduler


def main() -> None:
    container = get_container()
    settings = container.settings
    configure_logging(settings.log_level, settings.log_json)
    log = logging.getLogger("worker")
    if settings.run_scheduler:
        SyncScheduler(container).start()
    if settings.queue_backend != "rq":
        log.error("worker requires QUEUE_BACKEND=rq (inline mode runs jobs inside the API process)")
        raise SystemExit(2)
    from redis import Redis
    from rq import Worker

    worker = Worker([settings.queue_name], connection=Redis.from_url(settings.redis_url))
    log.info("worker listening on queue %s", settings.queue_name)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
