"""
Pydantic models for the notes.md API.
"""

from typing import Optional
from pydantic import BaseModel


class RegisterRequest(BaseModel):
    """User registration request."""
    username: str
    password: str


class LoginRequest(BaseModel):
    """User login request."""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Response containing JWT token and user info."""
    token: str
    user: dict


class UserResponse(BaseModel):
    """Response with user info."""
    user: dict


class PairGenerateResponse(BaseModel):
    """Response with pairing token and QR data."""
    pairing_token: str
    qr_data: str


class PairClaimRequest(BaseModel):
    """Request to claim a pairing token."""
    pairing_token: str
    device_name: Optional[str] = None


class PairStatusResponse(BaseModel):
    """Response with pairing status."""
    claimed: bool
    claimed_at: Optional[str] = None


# ── Sync models ─────────────────────────────────────────────────────────────


class SyncFileInfo(BaseModel):
    """Information about a single synced file."""
    path: str
    mtime: str
    hash: str


class SyncListResponse(BaseModel):
    """Response for /sync/list."""
    files: list[SyncFileInfo]
    server_time: str


class SyncDiffRequest(BaseModel):
    """Request body for /sync/diff."""
    files: list[SyncFileInfo]


class SyncDiffResponse(BaseModel):
    """Response for /sync/diff."""
    remote_updates: list[SyncFileInfo]
    local_uploads: list[SyncFileInfo]
    conflicts: list[dict]


class SyncUploadResponse(BaseModel):
    """Response for /sync/upload."""
    path: str
    mtime: str
    hash: str
