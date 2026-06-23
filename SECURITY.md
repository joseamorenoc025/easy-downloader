# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in EasyDownloader, please report it responsibly.

**Do NOT open a public issue.** Instead, email:

**joseamorenoc025@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive a response within 48 hours. Credit will be given in the release notes if you wish.

## Supported Versions

| Version | Supported |
|---|---|
| 2.x | ✅ Yes |
| < 2.0 | ❌ No |

## Security Measures

- Electron sandbox enabled (`sandbox: true`)
- Context isolation enabled (`contextIsolation: true`)
- Node integration disabled (`nodeIntegration: false`)
- Strict Content Security Policy (CSP)
- URL validation on all download handlers
- Path validation on folder open operations
- No shell injection vectors (`shell: false` in spawn calls)
