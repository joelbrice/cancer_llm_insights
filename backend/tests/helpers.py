"""Test helpers."""

from __future__ import annotations

import time


def make_pdf(pages: list[list[str]], title: str | None = None) -> bytes:
    """Build a small valid PDF (Helvetica text, one line per string) without third-party libraries."""
    objects: list[bytes] = []

    def add(obj: bytes) -> int:
        objects.append(obj)
        return len(objects)

    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    page_ids, content_ids = [], []
    for lines in pages:
        ops = ["BT", "/F1 11 Tf", "14 TL", "56 780 Td"]
        for line in lines:
            safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            ops.append(f"({safe}) Tj T*")
        ops.append("ET")
        stream = "\n".join(ops).encode("latin-1")
        content_ids.append(add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"))
    pages_id = len(objects) + len(pages) + 1
    for cid in content_ids:
        page_ids.append(add(b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>"
                            % (pages_id, font, cid)))
    kids = b" ".join(b"%d 0 R" % p for p in page_ids)
    add(b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, len(page_ids)))
    info = add(b"<< /Title (%s) /Producer (tests) >>" % (title or "").encode("latin-1")) if title else None
    catalog = add(b"<< /Type /Catalog /Pages %d 0 R >>" % pages_id)

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    trailer = b"<< /Size %d /Root %d 0 R" % (len(objects) + 1, catalog)
    if info:
        trailer += b" /Info %d 0 R" % info
    out += b"trailer\n" + trailer + b" >>\nstartxref\n%d\n%%%%EOF\n" % xref
    return bytes(out)


def wait_for_job(client, job_id: str, headers: dict | None = None, timeout: float = 60.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/api/v1/admin/jobs/{job_id}", headers=headers or {}).json()
        if job["status"] in ("succeeded", "failed", "cancelled"):
            return job
        time.sleep(0.1)
    raise TimeoutError(f"job {job_id} did not finish")
