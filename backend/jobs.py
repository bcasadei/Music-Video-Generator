import asyncio
from typing import Literal
from dataclasses import dataclass, field

Status = Literal["queued", "generating", "done", "error"]


@dataclass
class Job:
    id:        str
    status:    Status = "queued"
    progress:  int    = 0        # 0-100
    message:   str    = ""
    clip_path: str    = ""
    error:     str    = ""


_store: dict[str, Job] = {}
_lock  = asyncio.Lock()


async def create(job_id: str) -> Job:
    async with _lock:
        job = Job(id=job_id)
        _store[job_id] = job
        return job


async def update(job_id: str, **kwargs) -> Job | None:
    async with _lock:
        job = _store.get(job_id)
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
        return job


async def get(job_id: str) -> Job | None:
    async with _lock:
        return _store.get(job_id)


async def delete(job_id: str) -> None:
    async with _lock:
        _store.pop(job_id, None)
