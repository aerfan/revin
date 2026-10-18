# Security Policy

## Supported Versions

We actively maintain and provide security patches for the following branches:

| Version / Branch | Supported | Notes |
| :--- | :--- | :--- |
| `canary` | :white_check_mark: | Primary staging and security audit branch |
| `main` | :white_check_mark: | Stable production release branch (`revin-alpha.vercel.app`) |
| Historical commits | :x: | Not supported; upgrade to latest `main` or `canary` |

## Security Architecture & Defenses

Revin incorporates defense-in-depth protections verified by automated CI penetration testing (`test/canary.security.js`):
1. **OWASP CWE-1236 (CSV Formula & DDE Injection):** Formula triggers (`=`, `+`, `-`, `@`, `|`) are escaped with leading single quotes `'`; fields with tabs or semicolons are quoted.
2. **OWASP CWE-1321 (Prototype Pollution):** Three-way state merging helpers filter out `__proto__`, `constructor`, and `prototype` keys.
3. **OWASP CWE-79 (Stored & DOM Cross-Site Scripting):** All client inputs are sanitized, length-clamped, and escaped in DOM rendering.
4. **OWASP CWE-200 (Commercial Data Privacy):** Client presentation mode (`.clean-mode`) strictly excludes internal margins and cost rates from the client DOM.
5. **OWASP CWE-22 (Path Traversal & Sibling Confinement):** Development server enforces strict `path.relative` containment and binds to loopback `127.0.0.1`.
6. **OWASP CWE-1333 (ReDoS Mitigation):** Regular expressions are fuzzed against 20,000-character adversarial inputs.
7. **Strict Build Gates & Fail-Closed Deployment:** Production builds fail closed (`process.exit(1)`) if required Supabase backend variables are missing.
8. **Hardened Content Security Policy:** Script execution is restricted to `'self' 'unsafe-inline'` without external CDNs; connections are scoped to the project backend origin.

> For historical remediation records and automated exploit tests (`ISSUE-003`, `ISSUE-004`, `ISSUE-008`, `ISSUE-010`, `ISSUE-011`, `ISSUE-012`), see [`CANARY_CHANGELOG.md`](CANARY_CHANGELOG.md).

## Reporting a Vulnerability

If you discover a security vulnerability or exploit in Revin, please do **NOT** open a public GitHub issue.

Instead, please report it via one of the following channels:
1. **GitHub Private Vulnerability Reporting:** Use the [Report a Vulnerability](https://github.com/aerfan/revin/security/advisories/new) button in the repository's Security tab.
2. **Email:** Contact the maintainer directly at `aerfan.work@gmail.com` with the subject line `[SECURITY] Revin Vulnerability Report`.

Please include:
- A description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal proof-of-concept (POC).
- Any affected browsers, operating systems, or environments.

## Response SLA

- **Initial Acknowledgment:** Within 24 hours.
- **Triage & Severity Assessment:** Within 48 hours.
- **Remediation & Patch Deployment:** Critical vulnerabilities are patched on `canary` within 72 hours, verified via automated penetration tests, and deployed to production.
