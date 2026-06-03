"""
Device pairing endpoints for notes.md.
WhatsApp Web-style QR code pairing between web and Android.
"""

import json
import secrets
from fastapi import APIRouter, HTTPException, Depends, Request

from database import get_db
from models import (
    PairClaimRequest,
    PairGenerateResponse,
    PairStatusResponse,
)
from auth import get_current_user, create_token

router = APIRouter(prefix="/pair", tags=["pairing"])


@router.post("/generate", response_model=PairGenerateResponse)
async def generate_pairing(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Generate a pairing token and QR data for device pairing.

    The QR data is a JSON string the Android app parses to extract
    the pairing token and server URL. The server URL is derived
    dynamically from the incoming request's base URL.
    """
    db = await get_db()
    try:
        pairing_token = secrets.token_urlsafe(32)

        # Derive server URL dynamically from the request
        server_url = str(request.base_url).rstrip("/")

        # QR data encodes connection info the Android app needs
        qr_data = json.dumps({
            "type": "notesmd_pair",
            "version": 1,
            "token": pairing_token,
            "server": server_url,
            "device_name": "notes.md",
            "trust_on_first_pair": True,
        })

        await db.execute(
            "INSERT INTO devices (user_id, pairing_token) VALUES (?, ?)",
            (user["id"], pairing_token),
        )
        await db.commit()

        return PairGenerateResponse(
            pairing_token=pairing_token, qr_data=qr_data
        )
    finally:
        await db.close()


@router.post("/claim")
async def claim_pairing(req: PairClaimRequest):
    """Claim a pairing token from the Android app.

    When the Android app scans the QR code, it sends the pairing token
    to this endpoint. The server links the device to the user account
    and returns a JWT for the Android app to use.
    """
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT d.id, d.user_id, u.username
            FROM devices d
            JOIN users u ON d.user_id = u.id
            WHERE d.pairing_token = ? AND d.paired_at IS NULL
            """,
            (req.pairing_token,),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=404,
                detail="Invalid or already claimed pairing token",
            )

        await db.execute(
            "UPDATE devices SET device_name = ?, paired_at = CURRENT_TIMESTAMP WHERE id = ?",
            (req.device_name or "Android Device", row["id"]),
        )
        await db.commit()

        # Create JWT for the Android device
        token = create_token(row["user_id"], row["username"])

        return {
            "token": token,
            "user": {"id": row["user_id"], "username": row["username"]},
        }
    finally:
        await db.close()


@router.get("/status/{pairing_token}", response_model=PairStatusResponse)
async def pairing_status(pairing_token: str):
    """Check if a pairing token has been claimed.

    The web app polls this endpoint to know when the QR code has been scanned.
    """
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT paired_at FROM devices WHERE pairing_token = ?",
            (pairing_token,),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=404, detail="Pairing token not found"
            )
        return PairStatusResponse(
            claimed=row["paired_at"] is not None,
            claimed_at=row["paired_at"],
        )
    finally:
        await db.close()
