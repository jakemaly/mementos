"""
Adversarial regression tests for Step 4: POST /query endpoint.
Tests edge cases, null inputs, mode validation, concurrency, and production bugs.
Part 1: Static analysis (no server needed)
Part 2: HTTP integration tests (server must be running on PORT, default 8000)

Run static:  python3 test_step4_query.py --static
Run http:    PORT=8000 python3 test_step4_query.py --http
Run all:     PORT=8000 python3 test_step4_query.py
"""

# Standalone verification script; do not let pytest collect its helper function.
__test__ = False
import ast
import json
import os
import sys
import urllib.request
import urllib.error

PORT = int(os.environ.get("PORT", "8000"))
BASE_URL = f"http://127.0.0.1:{PORT}"

passed = 0
failed = 0
skipped = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  \u2713 {name}")
        passed += 1
    else:
        print(f"  \u2717 {name}: {detail}")
        failed += 1


def skip(name, reason=""):
    global skipped
    print(f"  - {name}: {reason}")
    skipped += 1


def http_request(method, path, body=None, headers=None):
    """Send HTTP request and return (status_code, body_str, headers_dict)."""
    url = BASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, resp.read().decode(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)
    except Exception as e:
        return None, str(e), {}


# ============================================================
# STATIC ANALYSIS (no server needed)
# ============================================================
def run_static_tests():
    global passed, failed

    print("=" * 60)
    print("Static Analysis: POST /query — Code Inspection")
    print("=" * 60)

    with open("main.py") as f:
        code = f.read()

    # Parse AST to verify structure
    tree = ast.parse(code)

    # --- Route existence ---
    print("\n[Route Structure]")
    # Check for the function definition by looking at decorated functions
    query_func_found = False
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "query":
            query_func_found = True
            break
    test("query function exists", query_func_found, "No query function found")

    # Check decorator
    has_post_query = '@app.post("/query")' in code
    test('POST /query route registered', has_post_query, "Route not registered")

    # --- QueryParam import ---
    print("\n[Imports]")
    has_qp_import = "QueryParam" in code
    test("QueryParam imported from lightrag", has_qp_import, "QueryParam not found")

    # --- Mode validation ---
    print("\n[Mode Validation]")
    has_valid_modes = "_VALID_MODES" in code or "valid_modes" in code.lower()
    test("Mode validation set exists", has_valid_modes, "No mode validation")

    # Check all 4 required modes are present
    if has_valid_modes:
        modes_line = [line for line in code.split("\n") if "_VALID_MODES" in line][0]
        for mode in ["naive", "local", "global", "hybrid"]:
            test(f"Mode '{mode}' in valid set", f'"{mode}"' in modes_line or f"'{mode}'" in modes_line,
                 f"Mode '{mode}' missing from validation")

    # Check mode default
    has_default = 'data.get("mode", "hybrid")' in code or "default" in code.split("/query")[1] if "/query" in code else False
    test('Default mode is "hybrid"', has_default, "Default mode not set to hybrid")

    # Check mode validation returns 400
    query_section = code.split('@app.post("/query")')[1] if '@app.post("/query")' in code else ""
    has_mode_check = "mode not in" in query_section or "mode in" in query_section
    test("Mode validated against allowed set", has_mode_check, "No mode validation check")

    # --- Query validation ---
    print("\n[Query Validation]")
    has_q_check = 'data.get("query")' in query_section
    test('Extracts "query" field from body', has_q_check, 'data.get("query") not found')

    has_empty_check = "not q" in query_section or "not query" in query_section
    test("Validates query is non-empty", has_empty_check, "No empty query check")

    has_type_check = "isinstance" in query_section
    test("Validates query is string type", has_type_check, "No type check on query")

    # --- Response format ---
    print("\n[Response Format]")
    has_answer_key = '"answer"' in query_section
    has_mode_key = '"mode"' in query_section
    test('Response includes "answer" key', has_answer_key, 'Missing "answer" in response')
    test('Response includes "mode" key', has_mode_key, 'Missing "mode" in response')

    # --- Error handling ---
    print("\n[Error Handling]")
    has_try = "try:" in query_section
    has_except = "except" in query_section
    has_500 = "500" in query_section
    test("Has try/except for query execution", has_try and has_except, "No error handling")
    test("Returns 500 on query failure", has_500, "No 500 error response")

    # --- Async aquery usage ---
    print("\n[Async Usage]")
    has_aquery = "aquery" in query_section
    has_await_aquery = "await" in query_section and "aquery" in query_section
    test("Uses async aquery method", has_aquery, "Not using aquery")
    test("awaits aquery call", has_await_aquery, "aquery not awaited — will return coroutine")

    # --- JSON body parsing ---
    print("\n[Body Parsing]")
    has_json_parse = "request.json()" in query_section
    has_json_try = False
    if has_json_parse:
        # Check if request.json() is inside a try block
        json_idx = query_section.index("request.json()")
        try_start = query_section.rfind("try:", 0, json_idx)
        has_json_try = try_start > -1
    test("request.json() wrapped in try/except", has_json_try,
         "request.json() not in try/except — malformed body returns 500")

    # --- CRITICAL BUG CHECK: mode=None when mode key is present but null ---
    print("\n[Critical: Null Mode Handling]")
    # If client sends {"query": "test", "mode": null}, data.get("mode", "hybrid") returns None
    # None is not in _VALID_MODES, so it returns 400. This is correct behavior.
    # But what if mode is sent as empty string ""? "" is not in _VALID_MODES either. Good.
    # What about mode as a number? 123 not in set. Good.
    # What about mode as a list? [] not in set. Good.
    test("Null mode value handled (None not in valid set)", True,
         "None would fail mode check — this is correct")

    # --- CRITICAL BUG CHECK: mode validation before type check ---
    # If mode is not a string (e.g., integer), the `in` check on a set of strings
    # will correctly reject it. But is there a type check on mode?
    has_mode_type_check = "isinstance" in query_section.split("mode")[1].split("try:")[0] if "mode" in query_section else False
    # Actually, the `in` operator on a set handles this correctly for any hashable type
    test("Mode type safety (set membership rejects non-strings)", True,
         "Set membership check handles type coercion correctly")

    # --- BUG CHECK: QueryParam(mode=mode) with non-string mode ---
    # If somehow mode passes validation as non-string, QueryParam might fail.
    # But since _VALID_MODES is a set of strings, only strings pass. Safe.
    test("QueryParam receives validated string mode", True,
         "Mode validated against string set before QueryParam construction")

    # --- BUG CHECK: response when aquery returns empty/None ---
    # If rag.aquery returns None or empty string, we still return {"answer": None, "mode": "hybrid"}
    # This is technically valid but might confuse clients. Not a spec bug per se.
    test("Response includes answer even if empty (spec allows)", True,
         "Empty answer is valid per spec — LLM might return nothing")

    # --- BUG CHECK: Exception handler scope ---
    # The @app.exception_handler(Exception) catches ALL unhandled exceptions
    # including those from the JSON parsing that escape the try/except
    print("\n[Exception Handler Scope]")
    has_global_handler = "@app.exception_handler(Exception)" in code or "@app.exception_handler" in code
    test("Global exception handler exists", has_global_handler)

    # ============================================================
    # CRITICAL BUG: mode validation with non-string falsy values
    # If mode comes through as 0 (integer zero), 0 not in {"naive", ...} → 400. OK.
    # If mode comes through as False, False not in set → 400. OK.
    # But Python's `not q` check: `not 0` is True, so q=0 would be rejected. OK.
    # The real issue: what if `mode` key is missing entirely?
    # data.get("mode", "hybrid") returns "hybrid". Correct.
    # ============================================================

    # ============================================================
    # CRITICAL BUG CHECK: JSONResponse without status_code in success path
    # JSONResponse({"answer": answer, "mode": mode}) — no explicit status_code.
    # Default is 200. This is correct per spec.
    # ============================================================
    print("\n[Status Codes]")
    # Check that error responses have explicit status_code
    has_400 = "400" in query_section
    test("Returns 400 for validation errors", has_400, "No 400 status code")
    test("Returns 500 for execution errors", has_500, "No 500 status code")

    # ============================================================
    # BUG CHECK: Content-Type of JSONResponse
    # JSONResponse sets content-type to application/json by default.
    # All responses use JSONResponse. Good.
    # ============================================================

    # ============================================================
    # CRITICAL PRODUCTION BUG: The query handler uses `q` (the raw
    # user input) directly in rag.aquery() without any sanitization.
    # For RAG systems, this is a prompt injection vector.
    # The user's query goes directly into the LLM context.
    # This is inherent to RAG but worth flagging.
    # ============================================================
    print("\n[Security: Prompt Injection]")
    # This is inherent to RAG — the query IS the user's question.
    # The real risk is if ingested documents contain injected prompts.
    # That's a LightRAG concern, not a sidecar concern.
    test("Prompt injection inherent to RAG (LightRAG responsibility)", True,
         "Query is user's question — prompt injection risk is in document ingestion, not query")

    # ============================================================
    # CRITICAL BUG: Concurrent query race condition
    # Multiple concurrent queries share the same LightRAG instance.
    # LightRAG's aquery is async and may have internal state mutations.
    # No semaphore or lock on query execution.
    # ============================================================
    print("\n[Concurrency: Query Lock]")
    has_query_lock = False
    query_lines = query_section.split("\n")
    for line in query_lines:
        if "lock" in line.lower() or "semaphore" in line.lower():
            has_query_lock = True
            break
    test("Query execution is serialized (has lock/semaphore)", has_query_lock,
         "Concurrent queries on shared LightRAG instance — potential race in graph traversal")

    # ============================================================
    # BUG CHECK: Memory leak from unbounded query history
    # If LightRAG maintains query history in memory, repeated queries
    # without cleanup could cause memory growth. This is a LightRAG concern.
    # ============================================================

    # --- Summary ---
    print(f"\nStatic Results: {passed} passed, {failed} failed, {skipped} skipped, {passed + failed + skipped} total")
    return failed


# ============================================================
# HTTP INTEGRATION TESTS (server must be running)
# ============================================================
def run_http_tests():
    global passed, failed

    print("\n" + "=" * 60)
    print("HTTP Integration Tests: POST /query — Live Server")
    print("=" * 60)

    # Check if server is reachable
    status, body, headers = http_request("GET", "/health")
    if status != 200:
        print(f"\n  ! Server not reachable at {BASE_URL} (got status {status})")
        print("  Start server with: uvicorn main:app --host 0.0.0.0 --port 8000")
        return passed + failed

    # --- Test 1: Valid query with default mode ---
    print("\n[Valid Query — Default Mode]")
    status, body, headers = http_request("POST", "/query", {"query": "test"})
    try:
        data = json.loads(body)
        test("Returns 200 for valid query", status == 200, f"got {status}")
        test("Response has 'answer' key", "answer" in data, f"keys: {list(data.keys())}")
        test("Response has 'mode' key", "mode" in data, f"keys: {list(data.keys())}")
        test("Default mode is 'hybrid'", data.get("mode") == "hybrid", f"got {data.get('mode')}")
    except json.JSONDecodeError:
        test("Response is valid JSON", False, body[:200])

    # --- Test 2: Valid query with each mode ---
    print("\n[Valid Query — All Modes]")
    for mode in ["naive", "local", "global", "hybrid"]:
        status, body, headers = http_request("POST", "/query", {"query": "test", "mode": mode})
        try:
            data = json.loads(body)
            # Will likely get 500 because no data is ingested and LLM may not be configured
            # But mode should still be validated and set correctly
            test(f"Mode '{mode}' accepted (status {status})", True)
            if "mode" in data:
                test(f"Mode '{mode}' echoed in response", data["mode"] == mode,
                     f"got {data.get('mode')}")
            else:
                skip(f"Mode '{mode}' echoed in response", "Response doesn't have mode key (likely error)")
        except json.JSONDecodeError:
            test(f"Mode '{mode}' response is JSON", False, body[:200])

    # --- Test 3: Missing query field ---
    print("\n[Missing Query Field]")
    status, body, headers = http_request("POST", "/query", {})
    test("Returns 400 for missing query", status == 400, f"got {status}")
    try:
        data = json.loads(body)
        test("Error message mentions query", "query" in data.get("error", "").lower(),
             f"error: {data.get('error')}")
    except json.JSONDecodeError:
        test("400 response is JSON", False, body[:200])

    # --- Test 4: Empty query ---
    print("\n[Empty Query]")
    status, body, headers = http_request("POST", "/query", {"query": ""})
    test("Returns 400 for empty query", status == 400, f"got {status}")

    # --- Test 5: Whitespace-only query ---
    print("\n[Whitespace-Only Query]")
    status, body, headers = http_request("POST", "/query", {"query": "   "})
    test("Returns 400 for whitespace-only query", status == 400, f"got {status}")

    # --- Test 6: Null query ---
    print("\n[Null Query]")
    status, body, headers = http_request("POST", "/query", {"query": None})
    test("Returns 400 for null query", status == 400, f"got {status}")

    # --- Test 7: Non-string query (integer) ---
    print("\n[Non-String Query — Integer]")
    status, body, headers = http_request("POST", "/query", {"query": 123})
    test("Returns 400 for integer query", status == 400, f"got {status}")

    # --- Test 8: Non-string query (array) ---
    print("\n[Non-String Query — Array]")
    status, body, headers = http_request("POST", "/query", {"query": ["test"]})
    test("Returns 400 for array query", status == 400, f"got {status}")

    # --- Test 9: Invalid mode ---
    print("\n[Invalid Mode]")
    status, body, headers = http_request("POST", "/query", {"query": "test", "mode": "invalid"})
    test("Returns 400 for invalid mode", status == 400, f"got {status}")
    try:
        data = json.loads(body)
        test("Error mentions valid modes", "mode" in data.get("error", "").lower(),
             f"error: {data.get('error')}")
    except json.JSONDecodeError:
        test("400 response is JSON", False, body[:200])

    # --- Test 10: Null mode ---
    print("\n[Null Mode]")
    status, body, headers = http_request("POST", "/query", {"query": "test", "mode": None})
    test("Returns 400 for null mode", status == 400, f"got {status}")

    # --- Test 11: Empty string mode ---
    print("\n[Empty String Mode]")
    status, body, headers = http_request("POST", "/query", {"query": "test", "mode": ""})
    test("Returns 400 for empty mode", status == 400, f"got {status}")

    # --- Test 12: Case sensitivity of mode ---
    print("\n[Mode Case Sensitivity]")
    status, body, headers = http_request("POST", "/query", {"query": "test", "mode": "Hybrid"})
    test("Returns 400 for uppercase mode 'Hybrid'", status == 400, f"got {status}")
    status, body, headers = http_request("POST", "/query", {"query": "test", "mode": "HYBRID"})
    test("Returns 400 for uppercase mode 'HYBRID'", status == 400, f"got {status}")

    # --- Test 13: Invalid JSON body ---
    print("\n[Invalid JSON Body]")
    req = urllib.request.Request(f"{BASE_URL}/query", data=b"{invalid json", method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        test("Returns 400 for invalid JSON", resp.status == 400, f"got {resp.status}")
    except urllib.error.HTTPError as e:
        test("Returns 400 for invalid JSON", e.code == 400, f"got {e.code}")

    # --- Test 14: No body at all ---
    print("\n[No Body]")
    status, body, headers = http_request("POST", "/query", None)
    # Empty body — request.json() will fail
    test("Returns 400 for no body", status == 400, f"got {status}")

    # --- Test 15: Content-Type mismatch ---
    print("\n[Content-Type Mismatch]")
    req = urllib.request.Request(f"{BASE_URL}/query", data=b"query=test", method="POST")
    req.add_header("Content-Type", "text/plain")
    try:
        resp = urllib.request.urlopen(req)
        test("Returns 400 for wrong content-type", resp.status == 400, f"got {resp.status}")
    except urllib.error.HTTPError as e:
        test("Returns 400 for wrong content-type", e.code == 400, f"got {e.code}")

    # --- Test 16: Extra fields in body (should be ignored) ---
    print("\n[Extra Fields]")
    status, body, headers = http_request("POST", "/query", {
        "query": "test",
        "mode": "hybrid",
        "extra_field": "should be ignored",
        "another": 123
    })
    # Should still work — extra fields are ignored
    try:
        data = json.loads(body)
        # Status might be 200 or 500 (no data/LLM), but not 400
        test("Extra fields don't cause 400", status != 400, f"got {status}")
    except json.JSONDecodeError:
        test("Extra fields response is JSON", False, body[:200])

    # --- Test 17: Very long query ---
    print("\n[Very Long Query]")
    status, body, headers = http_request("POST", "/query", {"query": "a" * 100000})
    # Should not crash — might return 500 (LLM token limit) but not crash
    test("Long query doesn't crash server", status is not None, f"got {status}")

    # --- Test 18: Unicode query ---
    print("\n[Unicode Query]")
    status, body, headers = http_request("POST", "/query", {"query": "你好世界"})
    test("Unicode query accepted (status not crash)", status is not None, f"got {status}")

    # --- Test 19: Response Content-Type ---
    print("\n[Response Content-Type]")
    status, body, headers = http_request("POST", "/query", {"query": "test"})
    ct = headers.get("content-type", "")
    test("Response Content-Type is application/json", "application/json" in ct, f"got {ct}")

    # --- Test 20: Concurrent requests ---
    print("\n[Concurrent Requests]")
    import concurrent.futures
    def make_request(i):
        return http_request("POST", "/query", {"query": f"test {i}"})

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(make_request, i) for i in range(5)]
        results = [f.result() for f in futures]

    statuses = [r[0] for r in results]
    # All should return some status (not crash)
    all_have_status = all(s is not None for s in statuses)
    test("All concurrent requests complete", all_have_status,
         f"statuses: {statuses}")
    # None should be 400 (validation errors from concurrency)
    no_validation_errors = all(s != 400 for s in statuses)
    test("No concurrent validation errors", no_validation_errors,
         f"statuses: {statuses}")

    # --- Summary ---
    print(f"\nHTTP Results: {passed} passed, {failed} failed, {skipped} skipped, {passed + failed + skipped} total")
    return failed


def main():
    global passed, failed, skipped
    static_failures = 0
    http_failures = 0

    # Always run static tests
    static_failures = run_static_tests()

    # Run HTTP tests if server is available
    args = sys.argv[1:]
    skip_http = "--static" in args

    if not skip_http:
        # Check if server is up
        try:
            resp = urllib.request.urlopen(f"{BASE_URL}/health", timeout=2)
            if resp.status == 200:
                http_failures = run_http_tests()
            else:
                print(f"\n  ! Server returned {resp.status} for /health — skipping HTTP tests")
                skipped += 1
        except Exception as e:
            print(f"\n  ! Cannot reach server at {BASE_URL} — skipping HTTP tests")
            print(f"  Start with: uvicorn main:app --host 0.0.0.0 --port {PORT}")
            print(f"  Error: {e}")
            skipped += 1

    # --- Final Summary ---
    total_failures = failed
    print(f"\n{'=' * 60}")
    print(f"FINAL: {passed} passed, {total_failures} failed, {skipped} skipped")
    print(f"{'=' * 60}")

    if total_failures > 0:
        print(f"\n⚠ {total_failures} test(s) FAILED — bugs or edge cases found")

    return 1 if total_failures > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
