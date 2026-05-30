# Contributing

Thanks for helping improve `nf-bacalhau`.

Before opening a pull request:

- Run `./gradlew build` from the repository root.
- Run `pytest` from `site-coordinator/` after installing `pip install -e ".[dev]"`.
- Run `npm audit`, `npm run typecheck`, `npm test`, and `npm run build` from `dashboard/`.
- Update docs when behavior, configuration, or user-facing limitations change.

Live Bacalhau smoke tests are opt-in:

```bash
BACALHAU_INTEGRATION=1 ./gradlew integrationTest
```

Include a minimal Nextflow workflow/config pair for executor bugs whenever possible. See [docs/contributing.md](docs/contributing.md) for the longer checklist.
