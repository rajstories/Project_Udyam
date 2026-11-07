"""Check the running demo with fictional fixtures. Usage: python3 check_demo.py."""
import argparse
import base64
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SAMPLES = Path(__file__).resolve().parent / "samples"


def invoke(base, route, payload=None):
    raw = None if payload is None else json.dumps(payload).encode()
    request = Request(base + "/api/" + route, data=raw, headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=90) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def check(label, passed):
    if not passed:
        raise SystemExit("FAILED – " + label)
    print("PASS – " + label, flush=True)


def run(port):
    base = f"http://127.0.0.1:{port}"
    status, capabilities = invoke(base, "health")
    check("Local service available", status == 200 and capabilities.get("ok"))
    ids = json.loads((SAMPLES / "test-identifiers.json").read_text())
    fixture = {"kind": "gst", "identifier": ids["gst"], "consent": False}
    status, _ = invoke(base, "verify", fixture)
    check("Verification requires explicit consent", status == 403)
    for kind, identifier, result_status in [("gst", fixture["identifier"], "Active"), ("udyam", ids["udyam"], "Registered")]:
        status, result = invoke(base, "verify", {"kind": kind, "identifier": identifier, "consent": True})
        check(kind + " lookup returns masked Harmony Dental Care match",
              status == 200 and result.get("businessName") == "Harmony Dental Care" and
              result.get("status") == result_status and identifier not in json.dumps(result))
    if capabilities.get("model"):
        choices = ["P01", "P16", "P18"]
        status, result = invoke(base, "advice", {"language": "en", "needs": "A dental clinic needs broadband and work email.",
                                               "eligibleIds": choices})
        check("On-device model returned catalogue-grounded IDs and explanation",
              status == 200 and bool(result.get("productIds")) and
              set(result["productIds"]).issubset(choices) and bool(result.get("explanation")))
    else:
        print("SKIP – on-device generative model unavailable")
    if capabilities.get("ocr"):
        for filename, kind, should_pass in [("K02_gst_certificate.png", "gst", True),
                                           ("K02_udyam_certificate.png", "udyam", True),
                                           ("K11_address_proof.png", "address", False)]:
            data = base64.b64encode((SAMPLES / filename).read_bytes()).decode()
            status, result = invoke(base, "ocr", {"kind": kind, "consent": True, "image": "data:image/png;base64," + data})
            expected = (result.get("businessName") == "Harmony Dental Care" if should_pass
                        else result.get("documentDate") == "2025-10-31")
            check(filename + (" matched" if should_pass else " routed to review"),
                  status == 200 and result.get("passed") is should_pass and expected)
    else:
        print("SKIP – on-device OCR unavailable")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    run(parser.parse_args().port)
