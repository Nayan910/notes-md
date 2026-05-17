"""
notes.md API

FastAPI backend providing document conversion, user authentication,
and device pairing for the notes.md cross-platform markdown editor.
"""

import os
import tempfile
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

import pypandoc

from markitdown import MarkItDown

from database import init_db
from auth import router as auth_router
from pairing import router as pairing_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="notes.md API",
    description="Document conversion, auth, and device pairing for notes.md",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": "1.1.0",
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
