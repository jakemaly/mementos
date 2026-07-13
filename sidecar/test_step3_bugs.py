"""
Adversarial regression tests for Step 3: POST /insert — Bug Hunt.
Tests for the missing initialize_storages() call and other production bugs.
Run with: python3 test_step3_bugs.py  (no server needed — static + unit tests)
"""
import ast
import sys

passed = 0
failed = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  \u2713 {name}")
        passed += 1
    else:
        print(f"  \u2717 {name}: {detail}")
        failed += 1


def main():
    global passed, failed

    print("=" * 60)
    print("Step 3 Bug Hunt: POST /insert — Adversarial Verification")
    print("=" * 60)

    with open("main.py") as f:
        code = f.read()

    # =========================================================
    # BUG 1: Missing initialize_storages() call
    # LightRAG now requires await rag.initialize_storages() before
    # any ainsert/aquery call. Without it, PipelineNotInitializedError
    # is raised which manifests as "Broken pipe" to the HTTP client.
    # =========================================================
    print("\n[BUG 1: Missing initialize_storages()]")
    has_init = "initialize_storages" in code
    test("Calls initialize_storages() before insert", has_init,
         "LightRAG requires await rag.initialize_storages() before "
         "any ainsert/aquery. Missing call causes PipelineNotInitializedError "
         "which manifests as 'Broken pipe' 500 errors in production.")

    # =========================================================
    # BUG 2: Lazy init race condition
    # get_rag() is called from async handlers but the lazy init
    # (creating LightRAG + embedding model) is NOT awaited.
    # If two requests arrive simultaneously before _rag is set,
    # both could call _create_rag() concurrently, causing duplicate
    # Qdrant collection creation or other race conditions.
    # =========================================================
    print("\n[BUG 2: Lazy init race condition]")
    # Check if get_rag uses any locking mechanism
    has_lock = "Lock" in code or "lock" in code or "asyncio" in code.split("get_rag")[1].split("\n\n")[:1] if "get_rag" in code else False
    # More precise: check if any locking/async-guard pattern exists around _rag init
    has_init_guard = "asyncio.Lock" in code or "threading.Lock" in code
    test("Lazy init is thread-safe (has lock)", has_init_guard,
         "get_rag() has no locking — concurrent requests can trigger "
         "duplicate LightRAG initialization, causing race conditions "
         "on Qdrant collection creation.")

    # =========================================================
    # BUG 3: initialize_storages must be called asynchronously
    # If added, it must be awaited (not called sync from async context).
    # =========================================================
    print("\n[BUG 3: initialize_storages must be awaited]")
    # If initialize_storages exists, verify it's awaited
    if has_init:
        init_line = [line for line in code.split("\n") if "initialize_storages" in line][0]
        test("initialize_storages is awaited (not sync call)",
             "await" in init_line,
             "initialize_storages() is async — must be awaited")
    else:
        test("initialize_storages is awaited (not sync call)", False,
             "initialize_storages not present at all — see BUG 1")

    # =========================================================
    # BUG 4: The exception handler catches Exception but the
    # PipelineNotInitializedError gets swallowed and reported as
    # "Broken pipe" instead of the actual error. This makes debugging
    # impossible in production.
    # =========================================================
    print("\n[BUG 4: Exception handler masks root cause]")
    # The handler does: JSONResponse(status_code=500, content={"error": str(exc)})
    # But the actual exception (PipelineNotInitializedError) is caught and
    # the error message shown is "[Errno 32] Broken pipe" — a secondary error
    # from the connection being reset, not the root cause.
    # This is a consequence of BUG 1, not a separate bug.
    test("Exception handler preserves root cause (consequence of BUG 1)", has_init,
         "Root exception PipelineNotInitializedError is masked by Broken pipe error")

    # =========================================================
    # BUG 5: No validation that OPENAI_API_KEY is set before insert
    # The insert will "succeed" (return track_id) but entity extraction
    # will silently fail. The user gets no indication that the data
    # was ingested without knowledge graph construction.
    # =========================================================
    print("\n[BUG 5: No OPENAI_API_KEY validation]")
    has_key_check = "OPENAI_API_KEY" in code and ("if not" in code or "raise" in code or "check" in code.lower())
    test("Validates OPENAI_API_KEY is configured", has_key_check,
         "Without OPENAI_API_KEY, insert returns success but entity "
         "extraction silently fails — data ingested without knowledge graph.")

    # =========================================================
    # BUG 6: request.json() can raise on non-JSON content-type
    # If client sends form-encoded or no content-type, request.json()
    # raises which is caught by the generic Exception handler -> 500.
    # Should be 400 (Bad Request) not 500 (Internal Server Error).
    # =========================================================
    print("\n[BUG 6: Non-JSON body returns 500 instead of 400]")
    # Check if there's a try/except around request.json()
    insert_handler = code.split('@app.post("/insert")')[1] if '@app.post("/insert")' in code else ""
    json_in_try = "request.json()" in insert_handler.split("try:")[1].split("except")[0] if "try:" in insert_handler else False
    has_json_error_handling = "json" in insert_handler.lower() and "except" in insert_handler
    # Actually, request.json() is before the try block in the current code
    json_before_try = insert_handler.index("request.json()") < insert_handler.index("try:") if "request.json()" in insert_handler and "try:" in insert_handler else False
    test("request.json() errors return 400 (not 500)", not json_before_try,
         "request.json() is outside try/except — malformed content returns 500")

    # =========================================================
    # BUG 7: The spec says filename is optional but the code doesn't
    # pass it to rag.ainsert(). LightRAG's ainsert signature may accept
    # keywords for metadata. If filename is silently ignored, that's
    # a spec mismatch.
    # =========================================================
    print("\n[BUG 7: filename field silently ignored]")
    # Check if filename is extracted and used
    has_filename = 'data.get("filename")' in code or "'filename'" in code.split('/insert')[1] if '/insert' in code else False
    test("filename field is extracted and used", has_filename,
         "Spec says filename is optional metadata — code ignores it entirely.")

    # =========================================================
    # BUG 8: No idempotency / deduplication
    # If the same text is inserted twice, LightRAG creates duplicate
    # documents. No deduplication or idempotency key support.
    # =========================================================
    print("\n[BUG 8: No idempotency]")
    # This is a spec-level concern, not a bug per se.
    test("Idempotency support (spec-level, not critical)", False,
         "Duplicate inserts create duplicate documents — no dedup.")

    # =========================================================
    # BUG 9: Concurrent inserts to shared LightRAG instance
    # FastAPI handles concurrent requests. Multiple ainsert calls
    # on the same LightRAG instance may have race conditions in
    # graph construction (NetworkX is not thread-safe for writes).
    # =========================================================
    print("\n[BUG 9: Concurrent insert race condition]")
    test("Concurrent inserts are serialized (has semaphore/lock)", False,
         "Multiple concurrent ainsert calls on shared LightRAG instance "
         "may corrupt the NetworkX graph — no serialization mechanism.")

    # =========================================================
    # Verify the fix for the original event loop bug
    # =========================================================
    print("\n[Original Fix Verification: ainsert vs insert]")
    uses_async = "await rag.ainsert" in code
    no_sync = "rag.insert(text)" not in code
    test("Uses await rag.ainsert() (event loop fix confirmed)", uses_async)
    test("No sync rag.insert() calls remain", no_sync)

    # --- Summary ---
    print(f"\nResults: {passed} passed, {failed} failed, {passed + failed} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
