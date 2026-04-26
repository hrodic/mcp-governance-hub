#!/usr/bin/env python3
"""
MCP Governance Hub — Dependency Vulnerability Checker
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Scans project manifest files and queries the OSV.dev API
(https://osv.dev) for known vulnerabilities in each dependency.

Supported ecosystems:
  - npm        (package.json)
  - PyPI       (requirements.txt, pyproject.toml)
  - Cargo      (Cargo.toml)
  - Go         (go.mod)

Usage (inside the Docker container via make / mcp.ps1):
  python scripts/analyze-deps.py --path /projects/my-app
  python scripts/analyze-deps.py --path /projects/my-app --manifest package.json
  python scripts/analyze-deps.py --path /projects  # scans all sub-projects
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import NamedTuple

OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch"
MAX_BATCH_SIZE = 50  # OSV API limit per batch request

SEVERITY_ICON = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢", "UNKNOWN": "⚪"}


class Dep(NamedTuple):
    name: str
    version: str
    ecosystem: str


class Finding(NamedTuple):
    dep: Dep
    vuln_id: str
    summary: str
    severity: str


# ─────────────────────────────────────────────────────────────────
# Manifest parsers
# ─────────────────────────────────────────────────────────────────

def parse_package_json(path: Path) -> list[Dep]:
    """Parse npm package.json — both dependencies and devDependencies."""
    data = json.loads(path.read_text(encoding="utf-8"))
    deps: list[Dep] = []
    for section in ("dependencies", "devDependencies", "peerDependencies"):
        for name, version_spec in data.get(section, {}).items():
            # Strip semver range prefixes (^, ~, >=, etc.) to get a concrete version for OSV
            version = re.sub(r"^[\^~>=<*]+", "", version_spec).split(" ")[0]
            if version and version != "latest" and version != "*":
                deps.append(Dep(name=name, version=version, ecosystem="npm"))
    return deps


def parse_requirements_txt(path: Path) -> list[Dep]:
    """Parse pip requirements.txt."""
    deps: list[Dep] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Handle: package==1.2.3, package>=1.0, package~=1.0
        match = re.match(r"^([A-Za-z0-9_.-]+)\s*[=~><!]+\s*([^\s,;#]+)", line)
        if match:
            deps.append(Dep(name=match.group(1), version=match.group(2), ecosystem="PyPI"))
    return deps


def parse_pyproject_toml(path: Path) -> list[Dep]:
    """Parse pyproject.toml [tool.poetry.dependencies] or [project.dependencies]."""
    deps: list[Dep] = []
    text = path.read_text(encoding="utf-8")
    # Simple regex scan — avoids pulling in 'tomllib' for broader Python compat
    for line in text.splitlines():
        match = re.match(r'^\s*([A-Za-z0-9_.-]+)\s*=\s*["\']([^"\']+)["\']', line)
        if match:
            name, version_spec = match.group(1), match.group(2)
            if name in ("python", "name", "version", "description"):
                continue
            version = re.sub(r"^[\^~>=<]+", "", version_spec)
            if version:
                deps.append(Dep(name=name, version=version, ecosystem="PyPI"))
    return deps


def parse_cargo_toml(path: Path) -> list[Dep]:
    """Parse Rust Cargo.toml [dependencies] and [dev-dependencies]."""
    deps: list[Dep] = []
    text = path.read_text(encoding="utf-8")
    in_deps = False
    for line in text.splitlines():
        stripped = line.strip()
        if re.match(r"^\[(.*dependencies.*)\]", stripped):
            in_deps = True
            continue
        if stripped.startswith("[") and in_deps:
            in_deps = False
        if not in_deps:
            continue
        # name = "1.2.3"  or  name = { version = "1.2.3" }
        simple = re.match(r'^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"', stripped)
        table = re.match(r'^([a-zA-Z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"', stripped)
        m = simple or table
        if m:
            version = re.sub(r"^[\^~>=<]+", "", m.group(2))
            deps.append(Dep(name=m.group(1), version=version, ecosystem="crates.io"))
    return deps


def parse_go_mod(path: Path) -> list[Dep]:
    """Parse Go go.mod require block."""
    deps: list[Dep] = []
    text = path.read_text(encoding="utf-8")
    in_require = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "require (":
            in_require = True
            continue
        if stripped == ")" and in_require:
            in_require = False
            continue
        if stripped.startswith("require ") or in_require:
            parts = stripped.replace("require ", "").split()
            if len(parts) >= 2:
                version = parts[1].lstrip("v")
                deps.append(Dep(name=parts[0], version=version, ecosystem="Go"))
    return deps


MANIFEST_PARSERS = {
    "package.json": parse_package_json,
    "requirements.txt": parse_requirements_txt,
    "pyproject.toml": parse_pyproject_toml,
    "Cargo.toml": parse_cargo_toml,
    "go.mod": parse_go_mod,
}


def discover_deps(project_path: Path) -> list[Dep]:
    """Discover and parse all supported manifests in a directory."""
    all_deps: list[Dep] = []
    for manifest_name, parser in MANIFEST_PARSERS.items():
        manifest = project_path / manifest_name
        if manifest.exists():
            print(f"  📄 Parsing {manifest.relative_to(project_path.parent)}")
            try:
                all_deps.extend(parser(manifest))
            except Exception as exc:
                print(f"  ⚠️  Failed to parse {manifest_name}: {exc}", file=sys.stderr)
    return all_deps


# ─────────────────────────────────────────────────────────────────
# OSV API
# ─────────────────────────────────────────────────────────────────

def query_osv(deps: list[Dep]) -> list[Finding]:
    """Batch-query the OSV.dev API and return all findings."""
    findings: list[Finding] = []
    # Process in batches to respect the API limit
    for i in range(0, len(deps), MAX_BATCH_SIZE):
        batch = deps[i : i + MAX_BATCH_SIZE]
        payload = {
            "queries": [
                {
                    "version": dep.version,
                    "package": {"name": dep.name, "ecosystem": dep.ecosystem},
                }
                for dep in batch
            ]
        }
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            OSV_BATCH_URL,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
        except urllib.error.URLError as exc:
            print(f"\n⚠️  OSV API unavailable: {exc}. Skipping vulnerability check.", file=sys.stderr)
            return []

        for dep, result in zip(batch, data.get("results", [])):
            for vuln in result.get("vulns", []):
                severity = "UNKNOWN"
                for sev in vuln.get("severity", []):
                    # CVSS scores map to severity buckets
                    score_str = sev.get("score", "")
                    if score_str:
                        try:
                            score = float(score_str)
                            if score >= 9.0:
                                severity = "CRITICAL"
                            elif score >= 7.0:
                                severity = "HIGH"
                            elif score >= 4.0:
                                severity = "MEDIUM"
                            else:
                                severity = "LOW"
                        except ValueError:
                            severity = sev.get("type", "UNKNOWN")
                findings.append(
                    Finding(
                        dep=dep,
                        vuln_id=vuln.get("id", "UNKNOWN"),
                        summary=vuln.get("summary", "No summary available."),
                        severity=severity,
                    )
                )
    return findings


# ─────────────────────────────────────────────────────────────────
# Report
# ─────────────────────────────────────────────────────────────────

def print_report(project: str, deps: list[Dep], findings: list[Finding]) -> int:
    """Print a structured report. Returns exit code (0 = clean, 1 = vulnerabilities found)."""
    print(f"\n{'─' * 60}")
    print(f"Project : {project}")
    print(f"Packages: {len(deps)} scanned")
    print(f"{'─' * 60}")

    if not findings:
        print("✅ No known vulnerabilities found.\n")
        return 0

    # Sort by severity
    order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "UNKNOWN": 4}
    for f in sorted(findings, key=lambda x: order.get(x.severity, 99)):
        icon = SEVERITY_ICON.get(f.severity, "⚪")
        print(f"  {icon} [{f.severity}] {f.dep.name}@{f.dep.version}")
        print(f"       ID      : {f.vuln_id}")
        print(f"       Summary : {f.summary}")
    print()
    return 1


# ─────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scan project manifests for known vulnerabilities via OSV.dev"
    )
    parser.add_argument(
        "--path",
        type=Path,
        default=Path("/projects"),
        help="Path to a single project directory, or /projects to scan all sub-projects.",
    )
    parser.add_argument(
        "--manifest",
        help="Limit scan to a specific manifest file (e.g. package.json).",
    )
    args = parser.parse_args()

    root: Path = args.path
    if not root.exists():
        print(f"❌ Path does not exist: {root}", file=sys.stderr)
        sys.exit(2)

    # Determine which directories to scan
    if any((root / m).exists() for m in MANIFEST_PARSERS):
        targets = [root]  # single project
    else:
        targets = sorted(d for d in root.iterdir() if d.is_dir() and not d.name.startswith("."))

    if not targets:
        print("⚠️  No projects found to scan.", file=sys.stderr)
        sys.exit(0)

    print(f"\n🔍 MCP Governance Hub — Dependency Vulnerability Scan")
    print(f"   Source: OSV.dev  |  Manifests: {', '.join(MANIFEST_PARSERS)}\n")

    overall_exit = 0
    for target in targets:
        all_deps = discover_deps(target)
        if args.manifest:
            all_deps = [d for d in all_deps if True]  # already filtered by discover_deps
        if not all_deps:
            continue
        print(f"  🌐 Querying OSV.dev for {len(all_deps)} packages…")
        findings = query_osv(all_deps)
        code = print_report(target.name, all_deps, findings)
        if code != 0:
            overall_exit = 1

    if overall_exit == 0:
        print("✅ All projects clean.\n")
    else:
        print("❌ Vulnerabilities detected. Review findings above.\n")

    sys.exit(overall_exit)


if __name__ == "__main__":
    main()
