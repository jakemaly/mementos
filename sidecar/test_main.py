"""Standalone sidecar smoke runner for the current Knowledge Base contract."""
__test__ = False

import subprocess
import sys

if __name__ == "__main__":
    raise SystemExit(subprocess.call([sys.executable, "-m", "pytest", "test_knowledge_base_rag.py", "-k", "capabilities or stream"]))
