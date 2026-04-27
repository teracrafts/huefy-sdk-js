# Huefy TypeScript SDK Lab

Internal integration verification script. Tests the SDK without making real network calls, except for the health-check path.

## Usage

```bash
npm run lab
```

## What it tests

1. Initialization — create `HuefyEmailClient` with a dummy API key
2. Config validation — empty API key throws an error
3. HMAC signing — `signPayload` returns a 64-char hex signature
4. Error sanitization — IP addresses and emails are redacted
5. PII detection — `detectPotentialPII` identifies sensitive fields
6. Circuit breaker state — initial state is `CLOSED`
7. Health check — invokes `/health` against the configured base URL
8. Cleanup — `close()` runs without error
