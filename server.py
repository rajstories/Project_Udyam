#!/usr/bin/env python3
"""Local-only, synthetic-data server. Run python3 server.py from any directory."""
import argparse
import base64
import binascii
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
DIST = (ROOT / "dist").resolve()
SERVICE = ROOT / "service"
REGISTRY = json.loads((SERVICE / "registry.json").read_text())
CATALOGUE = json.loads((SERVICE / "catalogue.json").read_text())
GST = re.compile(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]")
UDYAM = re.compile(r"UDYAM-[A-Z]{2}-00-[0-9]{7}")
REFERENCE = date(2026, 7, 15)
MAX_BYTES = 6 * 1024 * 1024
NATIVE = None
MODEL = False
PROCESS_SLOTS = threading.BoundedSemaphore(2)


class InputError(Exception):
    pass


def normalized(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def lookup(kind, identifier):
    code = identifier.upper().strip()
    pattern = GST if kind == "gst" else UDYAM
    if not pattern.fullmatch(code):
        return {"ok": True, "found": False, "passed": False, "status": "Format mismatch", "maskedId": "", "businessName": ""}
    entry = REGISTRY[kind].get(hashlib.sha256(code.encode()).hexdigest())
    masked = "•••• " + code[-4:]
    if entry is None:
        return {"ok": True, "found": False, "passed": False, "status": "Not found", "maskedId": masked, "businessName": ""}
    name, status = entry
    return {"ok": True, "found": True, "passed": status in ("Active", "Registered"),
            "status": status, "maskedId": masked, "businessName": name}


def run_native(mode, data=b"", timeout=55):
    if not NATIVE:
        raise RuntimeError("On-device processing is unavailable on this machine.")
    if not PROCESS_SLOTS.acquire(timeout=1):
        raise RuntimeError("Local processor is busy. Try again in a moment.")
    try:
        result = subprocess.run([NATIVE, mode], input=data, capture_output=True, timeout=timeout)
        payload = json.loads(result.stdout)
        if result.returncode or "error" in payload:
            raise RuntimeError("On-device processing was unavailable. Try the sample journey.")
        return payload
    except (ValueError, OSError, subprocess.TimeoutExpired):
        raise RuntimeError("On-device processing did not complete. Please retry.") from None
    finally:
        PROCESS_SLOTS.release()


def gst_candidates(lines):
    # Vision may read a zero in one of the PAN letters on a rotated certificate.
    # Restrict substitutions to unambiguous character-type positions; require
    # an exact registry hit AND a matching business name before accepting one.
    for line in lines:
        letters = re.sub(r"[^A-Z0-9]", "", line.upper())
        for start in range(len(letters) - 14):
            candidate = list(letters[start:start + 15])
            for i in (2, 3, 4, 5, 6, 11):
                candidate[i] = {"0": "O", "1": "I", "5": "S"}.get(candidate[i], candidate[i])
            for i in (0, 1, 7, 8, 9, 10):
                candidate[i] = {"O": "0", "I": "1", "S": "5"}.get(candidate[i], candidate[i])
            value = "".join(candidate)
            if GST.fullmatch(value):
                yield value


def document_result(kind, lines):
    full = " ".join(lines)
    summary = {"ok": True, "kind": kind, "found": False, "passed": False, "maskedId": "",
               "businessName": "", "status": "Review", "reason": "The requested fields could not be confirmed."}
    if kind in ("gst", "udyam"):
        candidates = gst_candidates(lines) if kind == "gst" else (
            m.group(0) for m in UDYAM.finditer(re.sub(r"\s*-\s*", "-", full.upper())))
        matches = [lookup(kind, code) for code in set(candidates)]
        found = [candidate for candidate in matches if candidate["found"]]
        if len(found) != 1:
            summary["reason"] = "An unambiguous registry match could not be read. Try a clearer specimen."
            return summary
        result = found[0]
        summary.update(result)
        name_matches = normalized(result["businessName"]) in normalized(full)
        if not name_matches:
            summary.update(passed=False, status="Review", reason="The printed business name and registry could not be reconciled.")
        elif not result["passed"]:
            summary["reason"] = "The mock registry marks this registration " + result["status"].lower() + "."
        else:
            summary["reason"] = "The identifier and printed business name match the mock registry."
        return summary
    def after_label(label):
        for i, line in enumerate(lines[:-1]):
            if normalized(line) == label:
                return lines[i+1]
        return ""
    # The specimen ID and proof authenticity still require human/issuer review.
    if kind == "address":
        if "bill" not in full.lower():
            summary["reason"] = "The image could not be identified as an address bill."
            return summary
        business = after_label("billedto")
    else:
        if "signatory" not in full.lower():
            summary["reason"] = "The image could not be identified as a signatory specimen."
            return summary
        business = after_label("forbusiness")
    dates = set(re.findall(r"\b20\d\d-\d\d-\d\d\b", full))
    if len(dates) != 1:
        return summary
    try:
        stamp = date.fromisoformat(dates.pop())
    except ValueError:
        return summary
    days = (REFERENCE - stamp).days
    good = (0 <= days <= 90) if kind == "address" else days <= 0
    reason = ("Address bill is within the specimen’s 90-day window." if good else
              "Address bill is future-dated or older than the 90-day limit.") if kind == "address" else (
              "Specimen signatory ID is within its validity period." if good else "Specimen signatory ID has expired.")
    # The label and value need not be consecutive in a two-column OCR layout.
    # Return only an unambiguous known fictional enterprise, never a label or person.
    registered_names = {entry[0] for entry in REGISTRY["udyam"].values()}
    if business not in registered_names:
        business = ""
    summary.update(passed=good, status="Date check passed" if good else "Review", reason=reason,
                   businessName=business, documentDate=stamp.isoformat())
    return summary


def read_image(data):
    if not isinstance(data, str) or not re.match(r"^data:image/(png|jpeg|jpg);base64,", data):
        raise InputError("Choose a PNG or JPEG specimen.")
    try:
        binary = base64.b64decode(data.split(",", 1)[1], validate=True)
    except (ValueError, binascii.Error):
        raise InputError("Image could not be decoded.") from None
    if len(binary) > 4 * 1024 * 1024 or not (binary.startswith(b"\x89PNG\r\n\x1a\n") or binary.startswith(b"\xff\xd8\xff")):
        raise InputError("Use a PNG or JPEG image no larger than 4 MB.")
    return binary


def advice(payload):
    needs = payload.get("needs")
    allowed = payload.get("eligibleIds")
    if not isinstance(needs, str) or not (0 < len(needs.strip()) <= 1500):
        raise InputError("Describe the business need in at most 1,500 characters.")
    if not isinstance(allowed, list) or not (0 < len(allowed) <= 25) or any(not isinstance(i, str) or i not in CATALOGUE for i in allowed):
        raise InputError("Choose at least one eligible catalogue option.")
    if not MODEL:
        raise RuntimeError("The on-device generative model is unavailable.")
    options = {i: CATALOGUE[i] for i in allowed}
    language = {"hi": "Hindi", "en": "English"}.get(payload.get("language"), "English")
    prompt = ("Select up to three products from these candidates that most closely satisfy the stated need. "
              "Use only candidate product IDs. Exclude optional features unless requested. "
              "Return exactly a JSON object with productIds (an array) and explanation (one short sentence in "
              + language + "). Do not make up prices, eligibility, availability or service levels.\n"
              + json.dumps({"candidateProducts": options, "buyerNeed": needs}, ensure_ascii=False))
    raw = run_native("advice", prompt.encode(), timeout=60).get("text", "")
    match = re.search(r"\{.*\}", raw, re.S)
    try:
        result = json.loads(match.group(0))
        ids = result["productIds"]
        explanation = result["explanation"]
        if not isinstance(ids, list) or not ids or any(not isinstance(i, str) or i not in options for i in ids):
            raise ValueError()
        if not isinstance(explanation, str) or not explanation.strip():
            raise ValueError()
    except (AttributeError, KeyError, TypeError, ValueError):
        raise RuntimeError("The model gave an unverified answer. The catalogue advisor is available.") from None
    return {"ok": True, "productIds": list(dict.fromkeys(ids))[:3], "explanation": explanation[:500],
            "source": "Apple on-device model"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, content, media="application/json"):
        raw = json.dumps(content, ensure_ascii=False).encode() if media == "application/json" else content
        self.send_response(code)
        self.send_header("Content-Type", media)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(raw)

    def allowed_origin(self):
        authority = self.headers.get("Host", "")
        if authority not in (f"localhost:{self.server.server_port}", f"127.0.0.1:{self.server.server_port}"):
            return False
        origin = self.headers.get("Origin")
        return not origin or origin == "http://" + authority

    def do_GET(self):
        if not self.allowed_origin():
            return self.reply(403, {"ok": False, "error": "Open the app on localhost."})
        path = unquote(urlsplit(self.path).path)
        if path == "/api/health":
            return self.reply(200, {"ok": True, "ocr": bool(NATIVE), "model": MODEL})
        target = (DIST / (path.lstrip("/") or "index.html")).resolve()
        if not target.is_relative_to(DIST) or not target.is_file() or any(p.startswith(".") for p in target.relative_to(DIST).parts):
            return self.reply(404, {"ok": False, "error": "Unknown path."})
        return self.reply(200, target.read_bytes(), mimetypes.guess_type(target.name)[0] or "application/octet-stream")

    def do_POST(self):
        if not self.allowed_origin():
            return self.reply(403, {"ok": False, "error": "Open the app on localhost."})
        try:
            if self.headers.get_content_type() != "application/json":
                raise InputError("Send JSON.")
            size = int(self.headers.get("Content-Length", "0"))
            if not (0 < size <= MAX_BYTES):
                raise InputError("Request is empty or too large.")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise InputError("Supply a JSON object.")
            route = urlsplit(self.path).path
            kind = data.get("kind")
            if route in ("/api/verify", "/api/ocr") and data.get("consent") is not True:
                return self.reply(403, {"ok": False, "error": "Verification requires explicit consent."})
            if route == "/api/verify" and kind in ("gst", "udyam") and isinstance(data.get("identifier"), str):
                return self.reply(200, lookup(kind, data["identifier"]))
            if route == "/api/ocr" and kind in ("gst", "udyam", "address", "signatory"):
                image = read_image(data.get("image"))
                return self.reply(200, document_result(kind, run_native("ocr", image, timeout=75).get("lines", [])))
            if route == "/api/advice":
                return self.reply(200, advice(data))
            raise InputError("Unrecognised request.")
        except (InputError, ValueError, UnicodeError) as error:
            return self.reply(400, {"ok": False, "error": str(error) if isinstance(error, InputError) else "Invalid request."})
        except RuntimeError as error:
            return self.reply(503, {"ok": False, "error": str(error)})


def prepare_native(build):
    global NATIVE, MODEL
    if not shutil.which("swiftc"):
        return
    binary = os.path.join(build, "udyam-native")
    try:
        subprocess.run(["swiftc", "-parse-as-library", "-module-cache-path", os.path.join(build, "cache"),
                        "-o", binary, str(SERVICE / "native.swift")], capture_output=True, check=True, timeout=180)
        NATIVE = binary
        MODEL = bool(run_native("health").get("model"))
    except (RuntimeError, OSError, subprocess.SubprocessError):
        NATIVE = None
        MODEL = False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="udyam-local-") as build:
        print("Preparing optional on-device OCR and language model…", flush=True)
        prepare_native(build)
        with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
            print(f"Open http://127.0.0.1:{server.server_port} · OCR {'on' if NATIVE else 'off'} · GenAI {'on' if MODEL else 'off'}", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
