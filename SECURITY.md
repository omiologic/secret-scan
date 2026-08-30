# Security policy

## Supported versions

`@omiologic/secret-scan` has not yet had an approved public release. There is
currently no published version with a security-support commitment. This policy
will be updated when the first release is approved.

## Reporting a vulnerability

Do not include active credentials, private keys, access tokens, or other real
secrets in an issue, pull request, test fixture, log, screenshot, or proof of
concept.

Report vulnerabilities privately through the repository's
[GitHub security advisory form](https://github.com/omiologic/secret-scan/security/advisories/new).
Use unmistakably synthetic or revoked examples and include:

- the affected API or detector;
- the expected and observed result, without plaintext secret values;
- a minimal deterministic reproduction;
- the relevant runtime and package version or commit; and
- the potential impact at the client or authoritative server boundary.

Do not publicly disclose the issue until a fix and disclosure timeline have
been coordinated with the maintainers.

## Security model

The library detects and redacts likely credentials in untrusted text. It does
not validate whether credentials are live, store secrets, replace a vault, or
provide complete data-loss prevention. Client-side scanning is preventive UX;
security-sensitive applications must scan again at the server boundary.

The core is deterministic and performs no runtime network access, telemetry,
secret storage, or environment-dependent lookup. Findings and library errors
must contain classifications and original-input ranges only, never matched
plaintext.
