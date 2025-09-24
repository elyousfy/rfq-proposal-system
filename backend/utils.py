# backend/utils.py

import pandas as pd
import os
from PyPDF2 import PdfReader
import docx
import chardet

def excel_to_text(path: str) -> str:
    """
    Convert an Excel file into a plain-text representation.
    Each sheet will be flattened into CSV-like text.
    """
    try:
        xls = pd.ExcelFile(path)
    except Exception as e:
        return f"[EXCEL READ ERROR] {e}"

    parts = []
    for sheet in xls.sheet_names:
        try:
            df = xls.parse(sheet)
            # Limit huge sheets (avoid overload)
            if len(df) > 5000:
                df = df.head(5000)
            csv_like = df.to_csv(index=False)
            parts.append(f"=== SHEET: {sheet} ===\n{csv_like}")
        except Exception as e:
            parts.append(f"[SHEET ERROR {sheet}] {e}")

    return "\n\n".join(parts)

def file_to_text(contents: bytes, filename: str) -> str:
    """
    Convert an uploaded file (PDF, DOCX, TXT) into plain text.
    """
    ext = os.path.splitext(filename)[1].lower()
    text = ""

    try:
        if ext == ".pdf":
            # Save to temp file because PdfReader works with file paths
            tmp_path = f"./uploads/{filename}"
            with open(tmp_path, "wb") as f:
                f.write(contents)
            reader = PdfReader(tmp_path)
            text = "\n".join([page.extract_text() or "" for page in reader.pages])

        elif ext in [".doc", ".docx"]:
            tmp_path = f"./uploads/{filename}"
            with open(tmp_path, "wb") as f:
                f.write(contents)
            doc = docx.Document(tmp_path)
            text = "\n".join([p.text for p in doc.paragraphs])

        elif ext in [".txt"]:
            # Detect encoding before decoding with robust error handling
            try:
                detected = chardet.detect(contents)
                enc = detected.get("encoding") if detected else None
                confidence = detected.get("confidence", 0) if detected else 0

                # Only use detected encoding if confidence is reasonable
                if enc and confidence > 0.7:
                    text = contents.decode(enc, errors="replace")
                else:
                    # Fallback to UTF-8 with error replacement
                    text = contents.decode("utf-8", errors="replace")
            except Exception as decode_error:
                print(f"Encoding detection failed: {decode_error}")
                # Final fallback: try common encodings
                for fallback_enc in ["utf-8", "latin1", "cp1252"]:
                    try:
                        text = contents.decode(fallback_enc, errors="replace")
                        break
                    except:
                        continue
                else:
                    text = str(contents, errors="replace")

        else:
            # For unknown file types, use robust UTF-8 decoding
            text = contents.decode("utf-8", errors="replace")

    except Exception as e:
        print(f"Error reading {filename}: {e}")
        text = ""

    return text