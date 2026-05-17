"""
Sync endpoints for notes.md.
Provides git-backed sync functionality (JSON file storage for MVP).
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user

router = APIRouter(prefix="/sync", tags=["sync"])

# Directory to store user sync data
SYNC_DATA_DIR = Path(__file__).parent / "sync_data"
SYNC_DATA_DIR.mkdir(exist_ok=True)


def _get_user_sync_file(user_id: int) -> Path:
    """Get the sync file path for a user."""
    return SYNC_DATA_DIR / f"user_{user_id}.json"


def _load_user_sync_data(user_id: int) -> dict:
    """Load user's sync data from JSON file."""
    sync_file = _get_user_sync_file(user_id)
    if sync_file.exists():
        with open(sync_file, "r", encoding="utf-8") as f:
            return json.load(f)
    # Return default structure for new users
    return {
        "user_id": user_id,
        "last_sync": None,
        "revision": None,
        "pending_changes": [],
        "changes_log": [],
    }


def _save_user_sync_data(user_id: int, data: dict) -> None:
    """Save user's sync data to JSON file."""
    sync_file = _get_user_sync_file(user_id)
    with open(sync_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


# ── Request/Response Models ───────────────────────────────────────────────────


class SyncChange(BaseModel):
    """A single change in sync request."""
    path: str
    content: Optional[str] = None
    operation: str  # "upsert" or "delete"


class PushRequest(BaseModel):
    """Request body for /sync/push."""
    changes: list[SyncChange]


class PushResponse(BaseModel):
    """Response for /sync/push."""
    success: bool
    revision: str


class PullResponse(BaseModel):
    """Response for /sync/pull."""
    changes: list[dict]
    revision: str


class StatusResponse(BaseModel):
    """Response for /sync/status."""
    last_sync: Optional[str]
    pending_changes: int
    conflicts: list


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/status", response_model=StatusResponse)
async def sync_status(user: dict = Depends(get_current_user)):
    """
    Get the current sync status for the authenticated user.
    
    Returns the last sync timestamp, number of pending changes,
    and any conflicts (empty for MVP).
    """
    user_id = user["id"]
    data = _load_user_sync_data(user_id)
    
    last_sync = data.get("last_sync")
    pending = len(data.get("pending_changes", []))
    conflicts = data.get("conflicts", [])
    
    return StatusResponse(
        last_sync=last_sync,
        pending_changes=pending,
        conflicts=conflicts,
    )


@router.post("/push", response_model=PushResponse)
async def sync_push(request: PushRequest, user: dict = Depends(get_current_user)):
    """
    Push changes to the server.
    
    Accepts a list of changes with path, content, and operation type.
    Stores changes in a JSON file per user (MVP - no actual git).
    """
    user_id = user["id"]
    data = _load_user_sync_data(user_id)
    
    # Generate new revision
    new_revision = uuid.uuid4().hex[:12]
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Process each change
    for change in request.changes:
        if change.operation not in ("upsert", "delete"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid operation: {change.operation}. Must be 'upsert' or 'delete'."
            )
        
        change_record = {
            "path": change.path,
            "operation": change.operation,
            "content": change.content,
            "timestamp": timestamp,
            "revision": new_revision,
        }
        
        # Add to pending changes and changes log
        data["pending_changes"].append(change_record)
        data["changes_log"].append(change_record)
    
    # Update revision and last sync
    data["revision"] = new_revision
    data["last_sync"] = timestamp
    
    # Save to file
    _save_user_sync_data(user_id, data)
    
    return PushResponse(
        success=True,
        revision=new_revision,
    )


@router.get("/pull", response_model=PullResponse)
async def sync_pull(since: Optional[str] = None, user: dict = Depends(get_current_user)):
    """
    Pull changes from the server.
    
    Query param 'since' is the revision hash to get changes after.
    Returns all changes since that revision, or all changes if no revision provided.
    """
    user_id = user["id"]
    data = _load_user_sync_data(user_id)
    
    changes_log = data.get("changes_log", [])
    current_revision = data.get("revision", "")
    
    # Filter changes after the given revision
    if since:
        filtered_changes = [
            c for c in changes_log
            if c.get("revision", "") > since
        ]
    else:
        # Return all changes if no revision specified
        filtered_changes = changes_log
    
    return PullResponse(
        changes=filtered_changes,
        revision=current_revision,
    )


@router.get("/resolve")
async def sync_resolve(user: dict = Depends(get_current_user)):
    """
    Placeholder for future conflict resolution UI.
    
    Returns a message indicating this endpoint is for future use.
    """
    return {
        "message": "Conflict resolution UI not yet implemented",
        "note": "This endpoint is reserved for future conflict resolution functionality",
        "conflicts": [],
    }