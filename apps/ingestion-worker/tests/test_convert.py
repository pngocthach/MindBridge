from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

WORKER_DIRECTORY = Path(__file__).resolve().parents[1]
CONVERTER = WORKER_DIRECTORY / "convert.py"
FIXTURE_DIRECTORY = Path(__file__).with_name("fixtures")
SAMPLE_FILES = (
    "sample.pdf",
    "sample.docx",
    "sample.pptx",
    "sample.xlsx",
    "sample.html",
    "sample.epub",
)


class ConvertDocumentTests(unittest.TestCase):
    def test_converts_official_markitdown_format_fixtures(self) -> None:
        for fixture_name in SAMPLE_FILES:
            with self.subTest(fixture_name=fixture_name):
                completed_process = subprocess.run(
                    [sys.executable, str(CONVERTER), str(FIXTURE_DIRECTORY / fixture_name)],
                    capture_output=True,
                    check=False,
                    text=True,
                )

                self.assertEqual(completed_process.returncode, 0, completed_process.stderr)
                result = json.loads(completed_process.stdout)
                self.assertTrue(result["ok"])
                self.assertIsInstance(result["markdown"], str)
                self.assertTrue(result["markdown"].strip())
                self.assertIn("detectedMimeType", result["metadata"])

    def test_rejects_an_unsupported_binary_with_a_friendly_error(self) -> None:
        completed_process = subprocess.run(
            [sys.executable, str(CONVERTER), str(FIXTURE_DIRECTORY / "unsupported.bin")],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(completed_process.returncode, 1)
        result = json.loads(completed_process.stdout)
        self.assertEqual(
            result,
            {
                "ok": False,
                "error": {
                    "code": "UNSUPPORTED_FORMAT",
                    "message": "This document format is not supported.",
                },
            },
        )


if __name__ == "__main__":
    unittest.main()
