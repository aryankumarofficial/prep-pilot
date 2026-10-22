"""Bounded extraction subprocess. No macros, OCR, network fetches or shell evaluation."""

import json
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree


def extract(path: Path, extension: str) -> str:
    if extension == ".pdf":
        import pymupdf

        with pymupdf.open(path) as doc:
            if doc.is_encrypted or not 1 <= len(doc) <= 10:
                raise ValueError("Use an unencrypted PDF with 1–10 pages.")
            text = "\n".join(page.get_text() for page in doc)
    elif extension == ".docx":
        with ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > 400 or sum(i.file_size for i in entries) > 20 * 1024 * 1024:
                raise ValueError("This DOCX expands beyond the permitted size.")
            if "word/document.xml" not in archive.namelist():
                raise ValueError("This file is not a Word DOCX document.")
            raw = archive.read("word/document.xml")
            if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
                raise ValueError("Unsupported XML declarations.")
            root = ElementTree.fromstring(raw)
            text = "\n".join(
                "".join(p.itertext())
                for p in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p")
            )
    else:
        raise ValueError("Upload a PDF or DOCX file.")
    if len(text.strip()) < 40:
        raise ValueError(
            "No readable text was found. Upload a text-based PDF or DOCX; scanned images need OCR first."
        )
    if len(text) > 24000:
        raise ValueError("Keep the resume under 24,000 text characters.")
    return text.strip()


def main():
    try:
        if sys.platform != "win32":
            import resource

            resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        text = extract(Path(sys.argv[1]), sys.argv[2])
        print(json.dumps({"text": text}))
    except Exception as error:
        # Only explicit parser ValueErrors may be shown. Other library messages may contain internals.
        print(
            json.dumps(
                {"error": str(error) if isinstance(error, ValueError) else "This file could not be read."}
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
