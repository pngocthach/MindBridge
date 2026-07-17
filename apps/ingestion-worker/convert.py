from __future__ import annotations

import json
import mimetypes
import sys
from pathlib import Path

from markitdown import MarkItDown
from markitdown._exceptions import FileConversionException, UnsupportedFormatException

sys.stdout.reconfigure(encoding="utf-8")


def write_result(payload: dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def main() -> int:
    if len(sys.argv) != 2:
        write_result({
            "ok": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "Expected exactly one document path.",
            },
        })
        return 2

    file_path = Path(sys.argv[1])
    if not file_path.is_file():
        write_result({
            "ok": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "The uploaded file is unavailable.",
            },
        })
        return 2

    try:
        result = MarkItDown().convert(file_path)
    except UnsupportedFormatException:
        write_result({
            "ok": False,
            "error": {
                "code": "UNSUPPORTED_FORMAT",
                "message": "This document format is not supported.",
            },
        })
        return 1
    except FileConversionException:
        write_result({
            "ok": False,
            "error": {
                "code": "UNREADABLE_DOCUMENT",
                "message": "This document could not be read. Use an unprotected, text-based file.",
            },
        })
        return 1
    except Exception:
        write_result({
            "ok": False,
            "error": {
                "code": "CONVERSION_FAILED",
                "message": "The document conversion failed.",
            },
        })
        return 1

    markdown = result.text_content.strip()
    if not markdown:
        write_result({
            "ok": False,
            "error": {
                "code": "EMPTY_DOCUMENT",
                "message": "No readable text was found in this document.",
            },
        })
        return 1

    write_result({
        "ok": True,
        "markdown": markdown,
        "metadata": {
            "detectedMimeType": mimetypes.guess_type(file_path.name)[0],
        },
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
