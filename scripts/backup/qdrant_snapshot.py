"""Create, download and restore Qdrant collection snapshots with the standard library only, so it runs on any host
or inside the API container (`docker compose exec -T api python - ...`).

  python qdrant_snapshot.py save    OUT_FILE      # snapshot QDRANT_COLLECTION, download it, delete it on the server
  python qdrant_snapshot.py restore SNAPSHOT_FILE # upload a snapshot, replacing the collection
  python qdrant_snapshot.py count                 # points in the collection (restore checks)

Environment: QDRANT_URL (required), QDRANT_API_KEY, QDRANT_COLLECTION (default cancer_chunks).
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import urllib.parse
import urllib.request
import uuid


def _request(method: str, path: str, body: bytes | None = None, headers: dict[str, str] | None = None,
             timeout: float = 600):
    base = os.environ["QDRANT_URL"].rstrip("/")
    req = urllib.request.Request(base + path, data=body, method=method, headers=dict(headers or {}))
    if os.environ.get("QDRANT_API_KEY"):
        req.add_header("api-key", os.environ["QDRANT_API_KEY"])
    return urllib.request.urlopen(req, timeout=timeout)  # noqa: S310 (operator-supplied URL)


def _collection() -> str:
    return urllib.parse.quote(os.environ.get("QDRANT_COLLECTION", "cancer_chunks"), safe="")


def save(out_file: str) -> None:
    col = _collection()
    with _request("POST", f"/collections/{col}/snapshots?wait=true") as r:
        name = json.load(r)["result"]["name"]
    try:
        with _request("GET", f"/collections/{col}/snapshots/{urllib.parse.quote(name)}") as r, \
                open(out_file, "wb") as f:
            shutil.copyfileobj(r, f, 1 << 20)
    finally:  # snapshots are large: do not leave them on the Qdrant node
        _request("DELETE", f"/collections/{col}/snapshots/{urllib.parse.quote(name)}?wait=true").close()
    print(f"qdrant: saved {name} → {out_file}", file=sys.stderr)


class _Multipart:
    """A multipart/form-data body streamed from disk (snapshots can be many gigabytes)."""

    def __init__(self, path: str, boundary: str) -> None:
        self._head = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"snapshot\"; "
                      "filename=\"restore.snapshot\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode()
        self._tail = f"\r\n--{boundary}--\r\n".encode()
        self.length = len(self._head) + os.path.getsize(path) + len(self._tail)
        self._file = open(path, "rb")  # noqa: SIM115 (closed in read)
        self._stage = 0

    def read(self, size: int = -1) -> bytes:
        size = 1 << 20 if size is None or size < 0 else size
        if self._stage == 0:
            self._stage = 1
            return self._head
        if self._stage == 1:
            chunk = self._file.read(size)
            if chunk:
                return chunk
            self._file.close()
            self._stage = 2
            return self._tail
        return b""


def restore(snapshot_file: str) -> None:
    boundary = uuid.uuid4().hex
    body = _Multipart(snapshot_file, boundary)
    with _request("POST", f"/collections/{_collection()}/snapshots/upload?priority=snapshot&wait=true",
                  body, {"Content-Type": f"multipart/form-data; boundary={boundary}",  # type: ignore[arg-type]
                         "Content-Length": str(body.length)}) as r:
        json.load(r)
    print(f"qdrant: restored {snapshot_file}", file=sys.stderr)


def count() -> int:
    with _request("POST", f"/collections/{_collection()}/points/count", json.dumps({"exact": True}).encode(),
                  {"Content-Type": "application/json"}, timeout=60) as r:
        return int(json.load(r)["result"]["count"])


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "save" and len(sys.argv) == 3:
        save(sys.argv[2])
    elif cmd == "restore" and len(sys.argv) == 3:
        restore(sys.argv[2])
    elif cmd == "count":
        print(count())
    else:
        sys.exit(__doc__)
