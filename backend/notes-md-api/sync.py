"""
Sync endpoints for notes.md.
Provides file-level Last-Writer-Wins (LWW) sync by mtime.
"""

import hashlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from auth import get_current_user
from database import get_db
from models import (
    SyncFileInfo,
    SyncListResponse,
    SyncDiffRequest,
    SyncDiffResponse,
    SyncUploadResponse,
)

router = APIRouter(prefix="/sync", tags=["sync"])

# Directory to store synced note files
SYNC_DATA_DIR = Path(__file__).parent / "sync_data"
SYNC_DATA_DIR.mkdir(exist_ok=True)


def _get_user_notes_dir(user_id: int) -> Path:
    """Get the notes directory for a user, creating it if needed."""
    notes_dir = SYNC_DATA_DIR / str(user_id) / "notes"
    notes_dir.mkdir(parents=True, exist_ok=True)
    return notes_dir


def _safe_path(user_id: int, path: str) -> Path:
    """
    Resolve a note path safely, preventing path traversal.

    Ensures the resolved path stays within the user's notes directory.
    The path is joined and resolved, then checked against the user's
    notes directory prefix.
    """
    notes_dir = _get_user_notes_dir(user_id)
    # Use Path to resolve the full path
    full_path = (notes_dir / path).resolve()

    # Ensure the resolved path is within the notes directory
    notes_dir_resolved = notes_dir.resolve()
    try:
        full_path.relative_to(notes_dir_resolved)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid path: path traversal detected",
        )

    return full_path


def _compute_sha256(file_path: Path) -> str:
    """Compute SHA256 hash of a file."""
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha.update(chunk)
    return sha.hexdigest()


def _parse_mtime(mtime_str: str) -> datetime:
    """Parse an ISO 8601 mtime string into a timezone-aware datetime."""
    try:
        dt = datetime.fromisoformat(mtime_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid mtime format. Must be ISO 8601.",
        )


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/upload", response_model=SyncUploadResponse)
async def sync_upload(
    file: UploadFile = File(...),
    mtime: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """
    Upload a note file with Last-Writer-Wins (LWW) conflict detection.

    - Saves file to sync_data/{user_id}/notes/{path}
    - Stores metadata in the sync_files table
    - If the server already has a newer version of this file (based on mtime),
      returns 409 Conflict with the stored mtime and hash.
    """
    user_id = user["id"]
    path = file.filename or "untitled.md"

    # Read file content
    content = await file.read()

    # Validate mtime
    incoming_mtime = _parse_mtime(mtime)

    # LWW: Check existing file metadata
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT mtime, sha256 FROM sync_files WHERE user_id = ? AND path = ?",
            (user_id, path),
        )
        row = await cursor.fetchone()

        if row:
            stored_mtime = _parse_mtime(row["mtime"])

            # Incoming file is older or same age — conflict
            if incoming_mtime <= stored_mtime:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Conflict: server has a newer or identical version "
                        f"of this file. Stored mtime: {row['mtime']}, "
                        f"stored hash: {row['sha256']}"
                    ),
                )
    finally:
        await db.close()

    # Save file to disk
    safe_path = _safe_path(user_id, path)
    safe_path.parent.mkdir(parents=True, exist_ok=True)
    safe_path.write_bytes(content)

    file_hash = _compute_sha256(safe_path)

    # Upsert metadata in database
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO sync_files (user_id, path, mtime, sha256, uploaded_at)
               VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(user_id, path) DO UPDATE SET
                   mtime = excluded.mtime,
                   sha256 = excluded.sha256,
                   uploaded_at = CURRENT_TIMESTAMP""",
            (user_id, path, mtime, file_hash),
        )
        await db.commit()
    finally:
        await db.close()

    return SyncUploadResponse(path=path, mtime=mtime, hash=file_hash)


@router.get("/list", response_model=SyncListResponse)
async def sync_list(user: dict = Depends(get_current_user)):
    """List all synced files for the authenticated user."""
    user_id = user["id"]

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT path, mtime, sha256 FROM sync_files WHERE user_id = ? ORDER BY path",
            (user_id,),
        )
        rows = await cursor.fetchall()
    finally:
        await db.close()

    files = [
        SyncFileInfo(path=row["path"], mtime=row["mtime"], hash=row["sha256"])
        for row in rows
    ]

    return SyncListResponse(
        files=files,
        server_time=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/file/{path:path}")
async def sync_download(path: str, user: dict = Depends(get_current_user)):
    """Download a synced file with metadata headers.

    Returns the file content with:
    - Content-Type: text/markdown
    - X-File-Mtime header: ISO 8601 timestamp
    - X-File-Hash header: SHA256 hex digest
    """
    user_id = user["id"]

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT mtime, sha256 FROM sync_files WHERE user_id = ? AND path = ?",
            (user_id, path),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="File not found")
        stored_mtime = row["mtime"]
        stored_hash = row["sha256"]
    finally:
        await db.close()

    safe_path = _safe_path(user_id, path)
    if not safe_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(safe_path),
        media_type="text/markdown",
        headers={
            "X-File-Mtime": stored_mtime,
            "X-File-Hash": stored_hash,
        },
    )


@router.post("/diff", response_model=SyncDiffResponse)
async def sync_diff(
    req: SyncDiffRequest,
    user: dict = Depends(get_current_user),
):
    """
    Compare local file states against the server and return differences.

    For each file in the request:
    - If server's version is newer → included in ``remote_updates``
    - If client's version is newer → included in ``local_uploads``
    - If file exists on both sides with diverging mtimes → included in ``conflicts``
    - If both have same mtime/hash → skipped

    Files the server has but the client didn't send → ``remote_updates``
    Files the client has but the server doesn't → ``local_uploads``
    """
    user_id = user["id"]

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT path, mtime, sha256 FROM sync_files WHERE user_id = ?",
            (user_id,),
        )
        server_rows = await cursor.fetchall()
    finally:
        await db.close()

    # Build lookup dicts
    server_files = {
        row["path"]: {"mtime": row["mtime"], "hash": row["sha256"]}
        for row in server_rows
    }
    client_files = {f.path: {"mtime": f.mtime, "hash": f.hash} for f in req.files}

    remote_updates: list[SyncFileInfo] = []
    local_uploads: list[SyncFileInfo] = []
    conflicts: list[dict] = []

    # Compare server files against client
    for path, server_info in server_files.items():
        if path in client_files:
            client_info = client_files[path]
            try:
                server_mtime = _parse_mtime(server_info["mtime"])
                client_mtime = _parse_mtime(client_info["mtime"])

                if server_mtime > client_mtime:
                    remote_updates.append(
                        SyncFileInfo(
                            path=path,
                            mtime=server_info["mtime"],
                            hash=server_info["hash"],
                        )
                    )
                elif client_mtime > server_mtime:
                    local_uploads.append(
                        SyncFileInfo(
                            path=path,
                            mtime=client_info["mtime"],
                            hash=client_info["hash"],
                        )
                    )
                elif server_info["hash"] != client_info["hash"]:
                    # Same mtime but different content — conflict
                    conflicts.append(
                        {
                            "path": path,
                            "local_mtime": client_info["mtime"],
                            "remote_mtime": server_info["mtime"],
                        }
                    )
                # Same mtime and hash → skip
            except (ValueError, TypeError):
                # If mtime parsing fails, treat server as authoritative
                remote_updates.append(
                    SyncFileInfo(
                        path=path,
                        mtime=server_info["mtime"],
                        hash=server_info["hash"],
                    )
                )
        else:
            # Server has it, client doesn't
            remote_updates.append(
                SyncFileInfo(
                    path=path,
                    mtime=server_info["mtime"],
                    hash=server_info["hash"],
                )
            )

    # Check client-only files
    for path, client_info in client_files.items():
        if path not in server_files:
            local_uploads.append(
                SyncFileInfo(
                    path=path,
                    mtime=client_info["mtime"],
                    hash=client_info["hash"],
                )
            )

    return SyncDiffResponse(
        remote_updates=remote_updates,
        local_uploads=local_uploads,
        conflicts=conflicts,
    )
