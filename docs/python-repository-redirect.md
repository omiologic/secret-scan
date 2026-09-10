# `secret-scan-python` repository redirect (prepared, not applied)

`decision-release-bindings-in-lockstep` requires archiving the separately
created `secret-scan-python` GitHub repository once the monorepo's Python
binding is ready, and leaving a redirect to the monorepo instead of using it
as a source mirror or an independently released package. `bindings/python`
is that binding today, so the redirect text below is ready to use.

This document only prepares that text. It does not archive, unarchive, push
to, or otherwise mutate `secret-scan-python`. Applying it — replacing that
repository's README with the text below and archiving the repository through
GitHub's repository settings — is a separate, explicitly authorized action,
just as a release is (`AGENTS.md`, "Release authority"). Nothing here
performs it.

## README text to publish when archiving

Copy everything between the `---` markers below verbatim into
`secret-scan-python`'s `README.md` before archiving it.

---

# secret-scan-python has moved

This repository is archived and read-only. It never held a released
package independent of the monorepo: Python support for `secret-scan` now
lives at
[`bindings/python`](https://github.com/omiologic/secret-scan/tree/main/bindings/python)
in the [`omiologic/secret-scan`](https://github.com/omiologic/secret-scan)
monorepo, alongside the Rust core and the Node.js, browser, and CLI
surfaces that share it.

Install the package from PyPI once a release is approved:

```sh
pip install omiologic-secret-scan
```

```python
import secret_scan

result = secret_scan.scan_and_redact(text)
```

File issues and pull requests against the monorepo, not here:
https://github.com/omiologic/secret-scan/issues

---

## Why a redirect instead of a mirror

`decision-release-bindings-in-lockstep` rejects using `secret-scan-python` as
a source mirror or an independently released package because a second
publishable location for the same binding would let it drift from the
monorepo's lockstep version and conformance guarantees
(`decision-govern-cross-language-conformance`) the same way a permanent
`ts-legacy` implementation would have. Archiving it with a redirect keeps
exactly one source of truth while leaving a stable link for anyone who finds
the old repository first.
