# ADR 0003: Open-Source Governance Baseline

- Status: Accepted
- Date: 2026-07-06

## Context

The repository is intended to be public and contributor-friendly while protecting users from unsafe defaults and unreviewed changes to `main`.

## Decision

Use the following governance baseline:

- MIT license.
- Public GitHub repository.
- Issues and discussions enabled.
- Wiki disabled unless a future need is documented.
- Security policy and responsible disclosure instructions.
- Contributor guide, code of conduct, support policy, issue templates, PR template, and CODEOWNERS.
- Secret scanning, push protection, Dependabot alerts, and Dependabot update configuration.
- Dependabot tracks npm and GitHub Actions immediately; Docker image updates are deferred until the production Dockerfile and Compose update policy are documented.
- Protected `main` branch requiring pull requests, at least one approval, resolved conversations, linear history, and a required CI check.

## Consequences

- Contributors get clear entry points.
- `main` is protected before real feature work begins.
- Repository secrets are intentionally deferred until deployment automation is designed.
