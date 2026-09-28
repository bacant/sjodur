# Security Policy

Sjodur handles people's financial data. We take reports about vulnerabilities seriously and appreciate the time researchers invest in finding them.

## Supported versions

Sjodur is in pre-alpha. Security fixes land on `main` only. Once tagged releases exist, this table will list the versions that receive fixes.

| Version | Supported |
|---|---|
| `main` | yes |
| everything else | no |

## Reporting a vulnerability

Please **do not** open public issues, discussions or pull requests for security problems.

Report privately through one of these channels:

1. **GitHub private vulnerability reporting** (preferred): use *Report a vulnerability* under the *Security* tab of this repository, or open <https://github.com/<owner>/sjodur/security/advisories/new>.
2. **E-mail**: security@<your-domain>

Include as much of the following as you can:

- A description of the issue and its impact
- The component affected (backend / API, web frontend, mobile app, infrastructure) and the commit or version
- Steps to reproduce, a proof of concept, or a failing test
- Any suggested fix or mitigation

You will receive an acknowledgement within **3 working days**. We aim to confirm and assess the issue within **10 working days** and will keep you informed while we work on a fix.

## What happens next

- We assess severity using CVSS 3.1 as a guide.
- Critical and high-severity issues are fixed as fast as possible; lower severities are scheduled into the next release.
- Once a fix is available we publish a GitHub security advisory and, where applicable, request a CVE.
- We coordinate the disclosure date with you. If a fix takes longer, we will explain why; we do not ask reporters to wait more than **90 days** from the initial report.
- We credit reporters in the advisory and release notes unless they prefer to stay anonymous.

## Scope

**In scope**

- The Sjodur backend and API
- The Sjodur web frontend
- The Sjodur mobile app, once it exists
- Build, release and CI configuration in this repository

**Out of scope**

- Vulnerabilities in third-party services, libraries or infrastructure that we do not control (please report those upstream; a heads-up to us is still welcome)
- Denial-of-service or volumetric attacks, rate-limit findings without a demonstrated impact
- Reports from automated scanners without a working proof of concept
- Missing best-practice headers or configuration flags without a demonstrated exploit
- Self-XSS, clickjacking on pages without sensitive actions, and social engineering of maintainers or users

## Safe harbour

We will not pursue legal action against researchers who act in good faith and within these rules:

- Test only against your own accounts and data, or a local instance. Never access, modify or delete data belonging to other people.
- If you encounter personal or financial data of others, stop, do not store it, and tell us.
- Do not degrade the service for other users and do not run automated attacks against instances you do not operate.
- Give us reasonable time to fix the issue before disclosing it publicly.

Thank you for helping keep Sjodur and its users safe.
