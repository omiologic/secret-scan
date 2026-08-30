# secret-scan

Deterministic secret detection and redaction for browser and server JavaScript/TypeScript applications.

`secret-scan` is designed for applications that accept untrusted text—AI prompts, chat input, logs, terminal output, MCP/tool responses, configuration fragments, support tickets, or uploaded text—and need to prevent credentials from crossing a trust boundary.

> Detect and redact secrets before the text is persisted, logged, indexed, forwarded to tools, or sent to an AI model.

## Package

GitHub: `omiologic/secret-scan`  
NPM: `@omiologic/secret-scan`

```bash
npm install @omiologic/secret-scan
```

```ts
import { scanAndRedact } from "@omiologic/secret-scan";

const result = scanAndRedact(`
OPENAI_API_KEY=sk-proj-example-value
Authorization: Bearer eyJhbGciOi...
`);

console.log(result.text);
```

Possible output:

```text
OPENAI_API_KEY=<SECRET_1>
Authorization: Bearer <SECRET_2>
```

Findings contain classification and location metadata, not plaintext secret values.

## Why

Users routinely paste content containing API keys, bearer/OAuth tokens, GitHub tokens, AWS credentials, private keys, database URLs, webhook secrets, session tokens, and other high-entropy secrets.

Visual masking is not enough. If a UI displays `••••••` while the original value is still submitted, the secret has already crossed the boundary. `secret-scan` performs an actual transformation before downstream processing.

## Goals

- One runtime-neutral core for browsers and Node.js.
- Deterministic detection with no LLM or remote service.
- Side-effect-free core with no logging or telemetry by default.
- Known-format detectors plus contextual and entropy heuristics.
- Semantic placeholders such as `<SECRET_1>` that preserve useful structure.
- Findings that never expose plaintext secret values.
- Custom detector and policy extension points.
- Easy server-side enforcement even when client-side scanning is present.

## Non-goals

The initial library is not a complete DLP suite, PII classifier, credential vault, password manager, malware scanner, or replacement for infrastructure-level secret management.

## Browser use

Client-side scanning prevents an accidental secret from leaving the user's browser.

```ts
const result = scanAndRedact(userInput);

if (result.findings.length > 0) {
  showSecretWarning(result);
}

await fetch("/api/conversation", {
  method: "POST",
  body: JSON.stringify({ content: result.text }),
});
```

Client-side scanning is a preventive UX layer, not the authoritative security boundary.

## Server use

The server should scan again even when the browser already scanned the input.

```ts
const result = scanAndRedact(request.content);

if (result.findings.some((finding) => finding.action === "block")) {
  throw new Error("Blocked sensitive input");
}

await conversationStore.save(result.text);
return modelGateway.respond({ input: result.text });
```

This protects direct API consumers, older clients, CLIs, MCP clients, automation, agents, and future native clients.

## Tool and MCP output

Tool output should also be scanned before becoming model context:

```ts
const rawToolOutput = await tool.execute(args);
const safeToolOutput = scanAndRedact(rawToolOutput);
return safeToolOutput.text;
```

## Detection model

`secret-scan` combines:

1. **Known formats** — private keys, AWS access keys, GitHub tokens, JWTs, bearer tokens, provider API keys.
2. **Context** — assignments and headers such as `API_KEY`, `SECRET`, `ACCESS_TOKEN`, `PASSWORD`, `PRIVATE_KEY`, and `Authorization: Bearer`.
3. **Entropy** — random-looking values can increase confidence when combined with contextual or structural evidence.

Entropy alone should not trigger aggressive redaction because hashes, IDs, and generated names may also look random.

## Proposed API

```ts
export type SecretConfidence = "high" | "medium" | "low";
export type SecretAction = "redact" | "block" | "warn" | "allow";

export interface SecretFinding {
  id: string;
  type: string;
  detector: string;
  confidence: SecretConfidence;
  action: SecretAction;
  start: number;
  end: number;
}

export interface ScanResult {
  text: string;
  findings: SecretFinding[];
}

export function scan(input: string, options?: ScanOptions): SecretFinding[];
export function redact(input: string, findings: SecretFinding[], options?: ScanOptions): string;
export function scanAndRedact(input: string, options?: ScanOptions): ScanResult;
```

## Policy

Detection and enforcement are separate concerns.

| Detection | Default action |
| --- | --- |
| Private key | block |
| Known API key | redact |
| AWS credential | redact |
| OAuth/bearer token | redact |
| Session token | redact |
| Database URL with credentials | redact |
| High-confidence generic secret | redact |
| Medium-confidence generic secret | warn |

## Planned repository structure

```text
secret-scan/
├── src/
│   ├── detectors/
│   ├── entropy.ts
│   ├── policy.ts
│   ├── redact.ts
│   ├── registry.ts
│   ├── scan.ts
│   ├── types.ts
│   └── index.ts
├── test/
│   ├── detectors/
│   ├── false-positives/
│   └── integration/
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
├── LICENSE
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Release plan

### v0.1

- TypeScript core
- ESM package with browser and Node support
- detector interface and registry
- redaction engine and semantic placeholders
- known-format detectors
- contextual/entropy detector
- policy interface
- unit and false-positive tests
- browser and Node build tests
- GitHub Actions CI
- npm publication as `@omiologic/secret-scan`

### v0.2

- streaming/chunk scanning
- richer connection-string parsing
- improved overlap resolution
- detector diagnostics
- performance benchmarks
- runtime/framework helpers where justified

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Security reporting

Do not include active credentials in public issues. Use synthetic or revoked examples when reporting detector bypasses. A formal `SECURITY.md` should be added before the first public release.

## License

Recommended: MIT.
