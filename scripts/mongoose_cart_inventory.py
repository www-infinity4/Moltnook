#!/usr/bin/env python3
"""Inventory legacy Mongoose/C13b0 carts from a VERIFIED GitHub tree JSON.

No downloads, no shell execution, no network, no API keys, no pip.
Input is the returned {"tree":[{"path":"...","type":"blob","size":123}, ...]}
from a read-only repository tree request, once the original owner repo is accessible.
"""
import argparse
import fnmatch
import json
import pathlib
import re
import sys

MAX_TREE_ITEMS = 25000
MAX_CARTS = 2000
MAX_SCRIPT_BYTES = 125_000
BLOCKED_FOLDERS = {"tokens", "research", "secrets", "credentials", ".git", "node_modules"}
CART_RE = re.compile(r"^cart[a-z0-9_.-]*\.(?:py|sh)$", re.I)

def classify(path):
    if not isinstance(path, str) or len(path) > 240 or path.startswith("/"):
        return None
    parts = path.split("/")
    if any(p in {"", ".", ".."} for p in parts):
        return None
    if any(p.lower() in BLOCKED_FOLDERS for p in parts[:-1]):
        return None
    if len(parts) > 1 and parts[0].lower() != "carts":
        return None
    if not CART_RE.fullmatch(parts[-1]):
        return None
    return "python" if parts[-1].lower().endswith(".py") else "shell"

def inventory_tree(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("tree"), list):
        raise ValueError("GitHub tree JSON with a tree list is required")
    if payload.get("truncated") is True:
        raise ValueError("tree truncated; cannot claim complete cart inventory")
    rows = payload["tree"]
    if len(rows) > MAX_TREE_ITEMS:
        raise ValueError("tree too large for bounded inventory")
    found = []
    seen = set()
    for node in rows:
        if not isinstance(node, dict) or node.get("type") != "blob":
            continue
        path = node.get("path")
        kind = classify(path)
        size = node.get("size")
        if not kind or not isinstance(size, int) or size < 0 or size > MAX_SCRIPT_BYTES:
            continue
        if path.casefold() in seen:
            continue
        seen.add(path.casefold())
        found.append({"path": path, "kind": kind, "size": size,
                      "status": "discovered_not_executed"})
        if len(found) > MAX_CARTS:
            raise ValueError("cart inventory exceeds safe bound")
    found.sort(key=lambda x: x["path"].casefold())
    return {"schemaVersion": 1, "completeWithinInputTree": True,
            "cartCount": len(found), "carts": found,
            "sourceVerified": False,
            "executionVerified": False,
            "notice": "Metadata inventory only. Verify owner repository, pinned commit, permissions and actual file contents separately."}

def syntax_check_python(source):
    """Static syntax check only. Does not import, evaluate or execute the cart."""
    import ast
    if not isinstance(source, str) or len(source.encode("utf-8")) > MAX_SCRIPT_BYTES:
        raise ValueError("Python source unavailable or too large")
    ast.parse(source)
    return {"syntaxValid": True, "executed": False}

def main():
    p = argparse.ArgumentParser(description="Static inventory of a previously fetched GitHub cart tree")
    p.add_argument("tree_json", help="Saved JSON with GitHub tree items, not an arbitrary URL")
    args = p.parse_args()
    with open(args.tree_json, encoding="utf-8") as handle:
        output = inventory_tree(json.load(handle))
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
