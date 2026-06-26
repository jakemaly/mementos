"""
Regression tests for Step 1: Python Sidecar Boilerplate - FastAPI + Health Check.
Run with: python3 test_main.py (server must be running on PORT)
Or: PORT=8000 python3 test_main.py
"""
import json
import os
import sys
import concurrent.futures
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


def http_request(method, path, body=None, headers=None):
    url = BASE_URL + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
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
    print("Step 1 Verification: FastAPI Sidecar Boilerplate")
    print("=" * 60)

    # --- Requirements.txt ---
    print("\n[Requirements.txt]")
    with open("requirements.txt") as f:
        reqs = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    for pkg in ["fastapi", "uvicorn", "lightrag-hku", "sentence-transformers", "qdrant-client", "networkx"]:
        test(f"requirements.txt contains '{pkg}'", pkg in reqs)

    # --- Code structure ---
    print("\n[Code Structure]")
    with open("main.py") as f:
        code = f.read()

    test("main.py imports FastAPI", "from fastapi import FastAPI" in code)
    test("main.py defines app", "app = FastAPI(" in code)
    test("main.py has /health route", '@app.get("/health")' in code)
    test("health returns JSONResponse", "JSONResponse" in code)
    test("health returns {status: ok}", '"status": "ok"' in code)

    # --- Runtime ---
    print("\n[Runtime Tests]")
    status, body, headers = http_request("GET", "/health")
    test("GET /health returns 200", status == 200, f"got {status}")

    if body:
        try:
            data = json.loads(body)
            test("GET /health has 'status' key", "status" in data)
            test("GET /health status is 'ok'", data.get("status") == "ok")
        except json.JSONDecodeError:
            test("GET /health is valid JSON", False, body)

    test("Content-Type is application/json", headers.get("content-type", "").startswith("application/json"))

    # --- Edge cases ---
    print("\n[Edge Cases]")
    status, _, _ = http_request("POST", "/health")
    test("POST /health returns 405", status == 405, f"got {status}")

    status, _, _ = http_request("GET", "/nonexistent")
    test("GET /nonexistent returns 404", status == 404, f"got {status}")

    status, _, _ = http_request("GET", "/health?foo=bar")
    test("GET /health with query params returns 200", status == 200, f"got {status}")

    # --- Concurrency ---
    print("\n[Concurrency]")

    def concurrent_health(_):
        s, b, _ = http_request("GET", "/health")
        return s == 200 and json.loads(b).get("status") == "ok"

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = [f.result(timeout=10) for f in [executor.submit(concurrent_health, i) for i in range(20)]]

    test("20 concurrent requests all succeed", all(results), f"{sum(results)}/20 passed")

    # --- Production readiness ---
    print("\n[Production Readiness]")
    test("Has custom exception handler", "exception_handler" in code or "add_exception_handler" in code,
         "Unhandled exceptions return HTML in production")
    test("Has startup validation", "on_event" in code or "lifespan" in code,
         "Health returns OK even when deps fail")
    test("Has logging", "logging" in code or "logger" in code,
         "No logging for production debugging")

    # --- Summary ---
    print(f"\nResults: {passed} passed, {failed} failed, {passed + failed} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
