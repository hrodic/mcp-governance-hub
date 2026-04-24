# Workflow: Security & Compliance Audit

Use this workflow to perform a "Security Sanity Check" on a project directory.

## Steps
1. **Dependency Check**: Scan the project's dependency manifests (e.g. package.json, Cargo.toml, requirements.txt, go.mod) for known vulnerable versions.
2. **Secret Detection**: Scan for accidental `.env` leaks or hardcoded API keys.
3. **Architecture Compliance**: Ensure that sensitive logic (e.g., Auth, Database access) is isolated according to the global architecture.

## Output
- A summary report of findings.
- A list of "Critical" vs "Warning" items.
- A proposed plan to fix any identified issues.
