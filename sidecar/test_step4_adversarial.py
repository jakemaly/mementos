"""
Adversarial regression tests for Step 4: POST /query endpoint.
Focus: bugs that would cause production outages.
Covers: non-dict JSON, null inputs, mode validation, concurrency, response format.
Run: python3 test_step4_adversarial.py (server must be running on port 8000)
"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"
passed = 0
failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        print(f"  \u2713 {name}")
        passed += 1
    else:
        print(f"  \u2717 {name}: {detail}")
        failed += 1


def post(path, body=None, raw_body=None):
    """POST and return (status, parsed_json_or_None, raw_body_str)."""
    url = BASE + path
    if raw_body is not None:
        data = raw_body if isinstance(raw_body, bytes) else raw_body.encode()
    elif body is not None:
        data = json.dumps(body).encode()
    else:
        data = None
    req = urllib.request.Request(url, data=data, method="POST")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read().decode()
        try:
            return resp.status, json.loads(raw), raw
        except json.JSONDecodeError:
            return resp.status, None, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw), raw
        except json.JSONDecodeError:
            return e.code, None, raw


def main():
    global passed, failed

    # Sanity: server reachable
    req = urllib.request.Request(BASE + "/health")
    resp = urllib.request.urlopen(req)
    if resp.status != 200:
        print("Server not reachable — abort")
        return 1

    print("=" * 60)
    print("Adversarial Regression: POST /query (Step 4)")
    print("=" * 60)

    # ── 1. Non-dict JSON bodies (the bug the builder fixed) ──
    print("\n[Non-dict JSON body — builder fix verification]")
    for label, body in [
        ("array", b"[1,2,3]"),
        ("string", b'"hello"'),
        ("number", b"42"),
        ("boolean", b"true"),
        ("null", b"null"),
    ]:
        status, data, raw = post("/query", raw_body=body)
        check(f"Non-dict ({label}) → 400", status == 400, f"got {status}: {raw[:80]}")
        check(f"Non-dict ({label}) → JSON error", data is not None and "error" in (data or {}),
              f"got: {raw[:80]}")

    # ── 2. Missing / empty / null query ──
    print("\n[Query field validation]")
    status, data, _ = post("/query", {})
    check("Missing query → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": ""})
    check("Empty query → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": "   "})
    check("Whitespace query → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": None})
    check("Null query → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": 123})
    check("Integer query → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": ["test"]})
    check("Array query → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": True})
    check("Boolean query → 400", status == 400, f"got {status}")

    # ── 3. Mode validation ──
    print("\n[Mode validation]")
    for mode in ["naive", "local", "global", "hybrid"]:
        status, data, _ = post("/query", {"query": "test", "mode": mode})
        # 500 is expected (no LLM), but NOT 400
        check(f"Mode '{mode}' accepted (not 400)", status != 400, f"got {status}")

    status, data, _ = post("/query", {"query": "test", "mode": "invalid"})
    check("Invalid mode → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": "test", "mode": None})
    check("Null mode → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": "test", "mode": ""})
    check("Empty mode → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": "test", "mode": "Hybrid"})
    check("Case-sensitive mode 'Hybrid' → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", {"query": "test", "mode": 123})
    check("Integer mode → 400", status == 400, f"got {status}")

    # ── 4. Default mode ──
    print("\n[Default mode]")
    # When mode is omitted, default is "hybrid"
    # We can't verify the response body (500 from no LLM), but we verify it's not 400
    status, data, _ = post("/query", {"query": "test"})
    check("Omitted mode → not 400 (defaults to hybrid)", status != 400, f"got {status}")

    # ── 5. Malformed / missing body ──
    print("\n[Malformed body]")
    status, data, _ = post("/query", raw_body=b"{invalid json")
    check("Invalid JSON → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", raw_body=b"")
    check("Empty body → 400", status == 400, f"got {status}")

    status, data, _ = post("/query", raw_body=b"null")
    check("null body → 400", status == 400, f"got {status}")

    # ── 6. Extra fields (should be ignored, not cause 400) ──
    print("\n[Extra fields]")
    status, data, _ = post("/query", {"query": "test", "extra": "ignored", "mode": "hybrid"})
    check("Extra fields → not 400", status != 400, f"got {status}")

    # ── 7. Response format (on 400 errors, verify JSON structure) ──
    print("\n[Error response format]")
    status, data, raw = post("/query", {})
    check("400 has 'error' key", data is not None and "error" in data, f"keys: {list(data.keys()) if data else 'none'}")
    check("400 error is string", isinstance(data.get("error"), str), f"type: {type(data.get('error'))}")

    # ── 8. Concurrent requests (no crash / no data corruption) ──
    print("\n[Concurrency]")
    import concurrent.futures
    def concurrent_post(i):
        return post("/query", {"query": f"test {i}"})

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(concurrent_post, i) for i in range(10)]
        results = [f.result() for f in futures]

    statuses = [r[0] for r in results]
    check("All concurrent requests complete (no crash)", all(s is not None for s in statuses),
          f"statuses: {statuses}")
    check("No concurrent 400s (validation errors)", all(s != 400 for s in statuses),
          f"statuses: {statuses}")

    # ── 9. Large payloads ──
    print("\n[Large payloads]")
    status, data, _ = post("/query", {"query": "a" * 500000})
    check("500KB query → server survives", status is not None, f"got {status}")

    # ── 10. Unicode / special chars ──
    print("\n[Unicode / special chars]")
    status, data, _ = post("/query", {"query": "你好世界 🎉"})
    check("Unicode query → server survives", status is not None, f"got {status}")

    status, data, _ = post("/query", {"query": "\x00\x01\x02"})
    check("Binary-like query → server survives", status is not None, f"got {status}")

    # ── Summary ──
    print(f"\n{'=' * 60}")
    print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
    print(f"{'=' * 60}")
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
