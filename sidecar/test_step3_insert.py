"""
Regression tests for Step 3: Sidecar Ingestion Endpoint — POST /insert.
Tests edge cases, null inputs, empty values, and the critical event-loop bug.
Run with: PORT=8000 python3 test_step3_insert.py  (server must be running)
"""

# Standalone verification script; do not let pytest collect its helper function.
__test__ = False
import json
import os
import sys
import urllib.request
import urllib.error

PORT = int(os.environ.get("PORT", "8000"))
BASE_URL = f"http://127.0.0.1:{PORT}"

passed = 0
failed = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓ {name}")
        passed += 1
    else:
        print(f"  ✗ {name}: {detail}")
        failed += 1


def http_request(method, path, body=None, content_type="application/json"):
    url = BASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", content_type)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw), dict(e.headers)
        except json.JSONDecodeError:
            return e.code, raw, dict(e.headers)
    except Exception as e:
        return None, str(e), {}


def http_request_raw(method, path, body_bytes=None):
    """Send raw bytes (not JSON-encoded) for malformed input tests."""
    url = BASE_URL + path
    req = urllib.request.Request(url, data=body_bytes, method=method)
    if body_bytes is not None:
        req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, resp.read().decode(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)
    except Exception as e:
        return None, str(e), {}


def main():
    global passed, failed

    print("=" * 60)
    print("Step 3 Verification: POST /insert — Adversarial Tests")
    print("=" * 60)

    # =========================================================
    # 1. Code structure checks (static)
    # =========================================================
    print("\n[Code Structure]")
    with open("main.py") as f:
        code = f.read()

    test("POST /insert route exists", '@app.post("/insert")' in code)
    test("Insert route is async", "async def insert" in code)
    test("Validates text is present", 'data.get("text")' in code or '"text"' in code)
    test("Validates text is non-empty", "strip()" in code or "not text" in code)
    test("Returns 400 on invalid text", "400" in code)
    test("Calls rag.insert", "rag.insert" in code or "get_rag()" in code)
    test("Returns success JSON with track_id", '"track_id"' in code)
    test("Has exception handling", "except Exception" in code)
    test("Returns 500 on error", "500" in code)

    # =========================================================
    # 2. CRITICAL BUG: rag.insert() called from async context
    # =========================================================
    # LightRAG.insert() is a sync wrapper that calls
    # loop.run_until_complete() internally.
    # Calling it from an async FastAPI handler (where a loop is
    # already running) raises:
    #   RuntimeError: insert() cannot be called from within a running
    #   asyncio event loop. Use `await ainsert(...)` instead.
    #
    # The fix: use await rag.ainsert(text) instead of rag.insert(text)
    # =========================================================
    print("\n[CRITICAL: Event Loop Bug — sync insert from async handler]")
    uses_sync_insert = "rag.insert(text)" in code
    uses_async_insert = "await rag.ainsert" in code or "await rag.insert" in code
    test("Uses await rag.ainsert() (not rag.insert())",
         uses_async_insert,
         f"Code calls rag.insert() from async handler — "
         f"LightRAG.insert() calls run_until_complete() which "
         f"crashes inside a running event loop. "
         f"Fix: await rag.ainsert(text)")
    test("Does NOT call sync rag.insert() from async context",
         not uses_sync_insert,
         "rag.insert() will raise RuntimeError in production")

    # =========================================================
    # 3. Runtime: Happy path (will fail with the event loop bug)
    # =========================================================
    print("\n[Runtime: Happy Path]")
    status, body, headers = http_request("POST", "/insert", {
        "text": "The sky is blue because of Rayleigh scattering."
    })
    test("POST /insert returns 200", status == 200,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    if isinstance(body, dict):
        test("Response has success=true", body.get("success") is True,
             f"got: {body}")
        test("Response has message field", "message" in body,
             f"got keys: {list(body.keys())}")
        test("Response has track_id field", "track_id" in body,
             f"got keys: {list(body.keys())}")
        test("track_id is a non-empty string",
             isinstance(body.get("track_id"), str) and len(body.get("track_id", "")) > 0,
             f"got: {body.get('track_id')}")

    # =========================================================
    # 4. Edge case: empty text
    # =========================================================
    print("\n[Edge Case: Empty Text]")
    status, body, _ = http_request("POST", "/insert", {"text": ""})
    test("Empty text returns 400", status == 400,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # =========================================================
    # 5. Edge case: whitespace-only text
    # =========================================================
    print("\n[Edge Case: Whitespace-Only Text]")
    status, body, _ = http_request("POST", "/insert", {"text": "   \n\t  "})
    test("Whitespace-only text returns 400", status == 400,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # =========================================================
    # 6. Edge case: missing text field
    # =========================================================
    print("\n[Edge Case: Missing text Field]")
    status, body, _ = http_request("POST", "/insert", {})
    test("Missing text returns 400", status == 400,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # =========================================================
    # 7. Edge case: text is null/None
    # =========================================================
    print("\n[Edge Case: text is null]")
    status, body, _ = http_request("POST", "/insert", {"text": None})
    test("Null text returns 400", status == 400,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # =========================================================
    # 8. Edge case: text is a number
    # =========================================================
    print("\n[Edge Case: text is a number]")
    status, body, _ = http_request("POST", "/insert", {"text": 42})
    test("Numeric text returns 400", status == 400,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # =========================================================
    # 9. Edge case: text is an array
    # =========================================================
    print("\n[Edge Case: text is an array]")
    status, body, _ = http_request("POST", "/insert", {"text": ["hello"]})
    test("Array text returns 400", status == 400,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # =========================================================
    # 10. Edge case: text is an object
    # =========================================================
    print("\n[Edge Case: text is an object]")
    status, body, _ = http_request("POST", "/insert", {"text": {"nested": "value"}})
    test("Object text returns 400", status == 400,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # =========================================================
    # 11. Edge case: filename is optional (should not cause error)
    # =========================================================
    print("\n[Edge Case: filename optional]")
    # This will fail with the event loop bug, but we still check
    # that filename doesn't cause a validation error
    status, body, _ = http_request("POST", "/insert", {
        "text": "Test text with filename",
        "filename": "test.txt"
    })
    # If we get 500, that's the event loop bug, not a filename issue
    # If we get 200, filename is handled correctly
    # If we get 400, filename validation is broken
    test("filename field doesn't cause 400", status != 400,
         f"got {status} — filename should not trigger validation error")

    # =========================================================
    # 12. Edge case: no body at all
    # =========================================================
    print("\n[Edge Case: No Request Body]")
    status, body, _ = http_request_raw("POST", "/insert", None)
    test("No body returns error (400 or 500)", status in (400, 500),
         f"got {status}")

    # =========================================================
    # 13. Edge case: malformed JSON body
    # =========================================================
    print("\n[Edge Case: Malformed JSON]")
    status, body, _ = http_request_raw("POST", "/insert", b'{bad json}')
    test("Malformed JSON returns error", status in (400, 400, 500),
         f"got {status}")

    # =========================================================
    # 14. Edge case: empty JSON object body
    # =========================================================
    print("\n[Edge Case: Empty JSON object]")
    status, body, _ = http_request_raw("POST", "/insert", b'{}')
    test("Empty JSON object returns 400", status == 400,
         f"got {status}")

    # =========================================================
    # 15. Edge case: very long text
    # =========================================================
    print("\n[Edge Case: Very Long Text]")
    status, body, _ = http_request("POST", "/insert", {
        "text": "A" * 100000
    })
    # Should succeed (200) or fail with event loop bug (500), not timeout
    test("Long text returns 200 or 500 (not timeout)", status in (200, 500),
         f"got {status}")

    # =========================================================
    # 16. Edge case: unicode text
    # =========================================================
    print("\n[Edge Case: Unicode Text]")
    status, body, _ = http_request("POST", "/insert", {
        "text": "你好世界 🌍 Привет мир مرحبا بالعالم"
    })
    test("Unicode text returns 200 or 500 (not encoding error)",
         status in (200, 500), f"got {status}")

    # =========================================================
    # 17. Edge case: text with special characters
    # =========================================================
    print("\n[Edge Case: Special Characters]")
    status, body, _ = http_request("POST", "/insert", {
        "text": '<script>alert("xss")</script>\n\t\'"\\'
    })
    test("Special chars returns 200 or 500 (not crash)",
         status in (200, 500), f"got {status}")

    # =========================================================
    # 18. Content-Type check
    # =========================================================
    print("\n[Response Headers]")
    status, body, headers = http_request("POST", "/insert", {"text": "test"})
    ct = headers.get("content-type", "")
    test("Response Content-Type is application/json",
         "application/json" in ct, f"got: {ct}")

    # =========================================================
    # 19. Verify error response is JSON (not HTML)
    # =========================================================
    print("\n[Error Response Format]")
    status, body, headers = http_request("POST", "/insert", {"text": ""})
    ct = headers.get("content-type", "")
    is_json = isinstance(body, dict)
    test("400 error response is JSON", is_json,
         f"Content-Type: {ct}, body type: {type(body).__name__}")

    # =========================================================
    # 20. Spec compliance: response shape
    # =========================================================
    print("\n[Spec Compliance]")
    # The spec says response should be:
    # {"success": true, "message": "...", "track_id": "..."}
    # If the event loop bug is present, we can't verify this at runtime.
    # We verify from code inspection instead.
    test("Response includes 'success' key", '"success"' in code)
    test("Response includes 'message' key", '"message"' in code)
    test("Response includes 'track_id' key", '"track_id"' in code)

    # =========================================================
    # 21. Verify the rubric's manual test commands
    # =========================================================
    print("\n[Rubric Manual Tests]")
    # Rubric: curl -X POST ... -d '{"text":"Photosynthesis converts sunlight into chemical energy."}' returns success
    status, body, _ = http_request("POST", "/insert", {
        "text": "Photosynthesis converts sunlight into chemical energy."
    })
    test("Rubric test: photosynthesis text returns 200", status == 200,
         f"got {status}: {body if isinstance(body, str) else json.dumps(body)}")

    # Rubric: curl -X POST ... -d '{"text":""}' returns 400
    status, body, _ = http_request("POST", "/insert", {"text": ""})
    test("Rubric test: empty text returns 400", status == 400,
         f"got {status}")

    # --- Summary ---
    print(f"\nResults: {passed} passed, {failed} failed, {passed + failed} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
