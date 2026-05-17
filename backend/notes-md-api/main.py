"""
notes.md API

FastAPI backend providing document conversion, user authentication,
and device pairing for the notes.md cross-platform markdown editor.
"""

import os
import time
import tempfile
import logging
from pathlib import Path
from typing import Optional
from collections import defaultdict
from contextlib import asynccontextmanager

# ── App version & release notes ──────────────────────────────────────────────
APP_VERSION = "0.1.0"
LATEST_VERSION = "0.1.0"
BUILD_DATE = "2026-05-17"
APK_DOWNLOAD_PATH = "/download/apk"

RELEASE_NOTES: dict[str, str] = {
    "0.1.0": (
        "## v0.1.0 – Alpha release\n"
        "\n"
        "Initial release of **notes.md**. Feature highlights:\n"
        "\n"
        "- **Document conversion** – Upload PDF, DOCX, PPTX, XLSX, HTML, images, CSVs, and more → markdown\n"
        "- **Text conversion** – Paste HTML, CSV, or JSON snippets and convert to markdown\n"
        "- **Export** – Markdown → DOCX, ODT, HTML, TXT, PDF, EPUB, RST, LaTeX\n"
        "- **Authentication** – OTP-based email login\n"
        "- **Device pairing** – Pair phone and desktop for seamless workflow\n"
        "- **Health & formats** – API status and supported format listing\n"
        "\n"
        "---\n"
        "\n"
        "> **Note:** This is an early alpha. APIs and behavior may change without "
        "notice."
    ),
}

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

import pypandoc

from markitdown import MarkItDown

from database import init_db
from auth import router as auth_router
from pairing import router as pairing_router

# ---------------------------------------------------------------------------
# Rate limiter (in-memory) — 10 requests/minute per IP on auth endpoints
# ---------------------------------------------------------------------------
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 10

_rate_store: dict[str, list[float]] = defaultdict(list)
_last_cleanup: float = time.time()


def _clean_rate_store():
    """Remove entries older than the window."""
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW
    expired = []
    for ip, timestamps in list(_rate_store.items()):
        _rate_store[ip] = [t for t in timestamps if t > cutoff]
        if not _rate_store[ip]:
            expired.append(ip)
    for ip in expired:
        del _rate_store[ip]


def _is_rate_limited(ip: str) -> bool | int:
    """
    Check whether *ip* is rate limited.
    Returns ``False`` if the request is allowed, or the number of seconds
    until the client should retry if it is blocked.
    """
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW

    timestamps = _rate_store[ip]
    # Keep only timestamps still inside the window
    timestamps[:] = [t for t in timestamps if t > cutoff]

    if len(timestamps) >= RATE_LIMIT_MAX:
        retry_after = int(timestamps[0] + RATE_LIMIT_WINDOW - now) + 1
        return max(retry_after, 1)

    timestamps.append(now)
    return False


async def rate_limit_middleware(request: Request, call_next):
    """Apply rate-limiting on auth/pairing endpoints."""
    global _last_cleanup

    now = time.time()
    if now - _last_cleanup > 60:
        _clean_rate_store()
        _last_cleanup = now

    path = request.url.path
    if path in ("/auth/register", "/auth/login", "/pair/generate"):
        client_ip = request.client.host if request.client else "unknown"
        retry_after = _is_rate_limited(client_ip)
        if retry_after is not False:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too Many Requests — please slow down"},
                headers={"Retry-After": str(retry_after)},
            )

    return await call_next(request)


# ---------------------------------------------------------------------------
# JWT secret from environment (with dev fallback)
# ---------------------------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET")
if JWT_SECRET is None:
    JWT_SECRET = "notesmd-dev-secret-change-in-production"
    logging.warning(
        "JWT_SECRET environment variable is not set — using development default. "
        "Set JWT_SECRET in production!"
    )
else:
    logging.info("JWT_SECRET loaded from environment variable.")

ALGORITHM = "HS256"

# ---------------------------------------------------------------------------
# CORS origins from environment (comma-separated list)
# ---------------------------------------------------------------------------
_cors_env = os.environ.get("CORS_ORIGINS")
if _cors_env:
    CORS_ORIGINS = [origin.strip() for origin in _cors_env.split(",")]
else:
    CORS_ORIGINS = ["*"]
    logging.warning(
        "CORS_ORIGINS not set — allowing all origins (*). "
        "Set CORS_ORIGINS as a comma-separated list in production!"
    )

logging.info("Allowed CORS origins: %s", CORS_ORIGINS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="notes.md API",
    description="Document conversion, auth, and device pairing for notes.md",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth and pairing routers
app.include_router(auth_router)
app.include_router(pairing_router)

md = MarkItDown()

# Supported file extensions and their descriptions
SUPPORTED_FORMATS = {
    ".pdf": "PDF documents",
    ".docx": "Word documents",
    ".doc": "Word documents (legacy)",
    ".pptx": "PowerPoint presentations",
    ".ppt": "PowerPoint presentations (legacy)",
    ".xlsx": "Excel spreadsheets",
    ".html": "HTML files",
    ".htm": "HTML files",
    ".zip": "Zip archives (processed by extension)",
    ".csv": "CSV files",
    ".json": "JSON files",
    ".xml": "XML files",
    ".jpg": "JPEG images (OCR via embedded text)",
    ".jpeg": "JPEG images (OCR via embedded text)",
    ".png": "PNG images (OCR via embedded text)",
    ".gif": "GIF images (OCR via embedded text)",
    ".bmp": "BMP images (OCR via embedded text)",
    ".svg": "SVG images",
    ".md": "Markdown files (passthrough)",
}

# Export target formats
EXPORT_FORMATS = {
    "docx": "Word document",
    "odt": "OpenDocument text",
    "html": "HTML document",
    "txt": "Plain text",
    "pdf": "PDF document (requires LaTeX)",
    "epub": "EPUB ebook",
    "rst": "reStructuredText",
    "latex": "LaTeX document",
}


class TextConversionRequest(BaseModel):
    """Request body for /convert/text endpoint."""
    content: str
    source_format: Optional[str] = None  # e.g., "html", "csv", "json"


class ConversionResponse(BaseModel):
    """Response for conversion endpoints."""
    success: bool
    markdown: str
    title: Optional[str] = None
    filename: Optional[str] = None
    format: Optional[str] = None
    error: Optional[str] = None


# ── Version & update endpoints ────────────────────────────────────────────────


@app.get("/version")
async def version():
    """Return the current app version and build metadata."""
    return {
        "version": APP_VERSION,
        "build_date": BUILD_DATE,
        "android_apk_url": APK_DOWNLOAD_PATH,
    }


@app.get("/update/check")
async def update_check(current_version: str = "0.0.0"):
    """Check whether a newer version is available."""
    update_available = _compare_versions(current_version, LATEST_VERSION) < 0
    return {
        "update_available": update_available,
        "latest_version": LATEST_VERSION,
        "download_url": APK_DOWNLOAD_PATH,
        "release_notes": "Alpha release of notes.md",
    }


@app.get("/update/notes")
async def update_notes(version: str = APP_VERSION):
    """Return release notes for a given version.

    If *version* is not found in the release-notes catalog, returns a
    fallback message.
    """
    notes = RELEASE_NOTES.get(version)
    if notes is None:
        return {
            "version": version,
            "found": False,
            "release_notes": f"No release notes available for version {version}.",
        }
    return {
        "version": version,
        "found": True,
        "release_notes": notes,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────


def _compare_versions(a: str, b: str) -> int:
    """Compare two semver-like strings.

    Returns:
        -1 if *a* < *b*, 0 if equal, 1 if *a* > *b*.
    """
    def _parts(v: str):
        try:
            return [int(x) for x in v.split(".")]
        except ValueError:
            return [0]

    pa, pb = _parts(a), _parts(b)
    # Pad shorter list with zeros
    length = max(len(pa), len(pb))
    pa.extend([0] * (length - len(pa)))
    pb.extend([0] * (length - len(pb)))

    for x, y in zip(pa, pb):
        if x < y:
            return -1
        if x > y:
            return 1
    return 0


# ── Core endpoints ────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": APP_VERSION,
        "engine": "markitdown + pandoc",
    }


@app.get("/formats")
async def formats():
    """List supported conversion formats."""
    return {
        "import_formats": [
            {"extension": ext, "description": desc}
            for ext, desc in SUPPORTED_FORMATS.items()
        ],
        "export_formats": [
            {"format": fmt, "description": desc}
            for fmt, desc in EXPORT_FORMATS.items()
        ],
    }


@app.post("/convert/file", response_model=ConversionResponse)
async def convert_file(file: UploadFile = File(...)):
    """
    Upload a file and convert it to markdown.

    Accepts: PDF, DOCX, PPTX, XLSX, HTML, images, CSV, JSON, XML, and more.
    Returns the converted markdown content.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate extension
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS and ext != ".txt":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(SUPPORTED_FORMATS.keys())}",
        )

    # Save uploaded file to temp location
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Convert to markdown
        result = md.convert(tmp_path)
        markdown_content = result.text_content

        return ConversionResponse(
            success=True,
            markdown=markdown_content,
            title=Path(file.filename).stem,
            filename=file.filename,
            format=ext.lstrip("."),
        )
    except Exception as e:
        return ConversionResponse(
            success=False,
            markdown="",
            error=f"Conversion failed: {str(e)}",
            filename=file.filename,
        )
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except (OSError, UnboundLocalError):
            pass


@app.post("/convert/text", response_model=ConversionResponse)
async def convert_text(request: TextConversionRequest):
    """
    Convert raw text content to markdown.

    Provide content and optionally specify the source format hint.
    Useful for converting HTML snippets, CSV data, or JSON to markdown.
    """
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="No content provided")

    try:
        # Write content to a temp file with appropriate extension
        ext = ".html"  # default - handles HTML-like content well
        if request.source_format:
            format_ext_map = {
                "html": ".html", "htm": ".htm",
                "csv": ".csv", "json": ".json",
                "xml": ".xml", "md": ".md",
            }
            ext = format_ext_map.get(request.source_format.lower(), ".html")

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext, mode="w", encoding="utf-8") as tmp:
            tmp.write(request.content)
            tmp_path = tmp.name

        result = md.convert(tmp_path)

        return ConversionResponse(
            success=True,
            markdown=result.text_content,
            format=request.source_format or "html",
        )
    except Exception as e:
        return ConversionResponse(
            success=False,
            markdown="",
            error=f"Conversion failed: {str(e)}",
        )
    finally:
        try:
            os.unlink(tmp_path)
        except (OSError, UnboundLocalError):
            pass


class ExportRequest(BaseModel):
    """Request body for /convert/export endpoint."""
    markdown: str
    target_format: str  # docx, odt, html, txt, pdf, epub, rst, latex
    filename: Optional[str] = "document"


@app.post("/convert/export")
async def convert_export(request: ExportRequest):
    """
    Export markdown content to another format.

    Target formats: docx, odt, html, txt, pdf, epub, rst, latex
    Returns the converted file as a download.
    """
    if not request.markdown.strip():
        raise HTTPException(status_code=400, detail="No markdown content provided")

    target = request.target_format.lower()
    if target not in EXPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format '{target}'. Supported: {', '.join(EXPORT_FORMATS.keys())}",
        )

    binary_formats = {"docx", "odt", "epub", "pdf"}
    is_binary = target in binary_formats

    try:
        if is_binary:
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{target}") as tmp:
                pypandoc.convert_text(
                    request.markdown,
                    target,
                    format="md",
                    outputfile=tmp.name,
                    extra_args=["--wrap=preserve"],
                )
                tmp_path = tmp.name
            with open(tmp_path, "rb") as f:
                output = f.read()
        else:
            output = pypandoc.convert_text(
                request.markdown,
                target,
                format="md",
                outputfile=None,
                extra_args=["--wrap=preserve"],
            )

        from fastapi.responses import Response

        content_type_map = {
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "odt": "application/vnd.oasis.opendocument.text",
            "epub": "application/epub+zip",
            "pdf": "application/pdf",
            "html": "text/html",
            "txt": "text/plain",
            "rst": "text/plain",
            "latex": "text/plain",
        }
        disposition = "attachment" if is_binary else "inline"
        return Response(
            content=output,
            media_type=content_type_map.get(target, "application/octet-stream"),
            headers={
                "Content-Disposition": f'{disposition}; filename="{request.filename}.{target}"'
            },
        )
    except Exception as e:
        return ConversionResponse(
            success=False,
            markdown="",
            error=f"Export failed: {str(e)}",
            filename=request.filename,
        )
    finally:
        if is_binary and 'tmp_path' in dir():
            try:
                os.unlink(tmp_path)
            except (OSError, UnboundLocalError):
                pass


@app.get("/download/apk")
async def download_apk():
    """Download the latest notes.md Android APK."""
    apk_path = Path(__file__).parent.parent.parent / "notes-md-debug.apk"
    alt_path = Path(__file__).parent.parent.parent / "apps" / "notes-md-app" / "build" / "app" / "outputs" / "flutter-apk" / "app-debug.apk"

    if apk_path.exists():
        return FileResponse(str(apk_path), media_type="application/vnd.android.package-archive", filename="notes-md.apk")
    elif alt_path.exists():
        return FileResponse(str(alt_path), media_type="application/vnd.android.package-archive", filename="notes-md.apk")
    else:
        raise HTTPException(status_code=404, detail="APK not found. Build the Flutter app first.")
