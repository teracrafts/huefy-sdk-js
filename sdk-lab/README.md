# Huefy TypeScript SDK Lab

Verifies the core email contract through the real `HuefyEmailClient` without sending live email.

## Run

```bash
npm run lab
```

from `sdks/typescript/`.

## Scenarios

1. Initialization
2. Single email contract
3. Bulk email contract
4. Validation rejects invalid single recipient
5. Validation rejects invalid bulk request
6. Health check path
7. Cleanup

## Notes

- The lab uses a local stubbed transport, not the live API.
- It verifies request shaping, response parsing, and validation boundaries.
