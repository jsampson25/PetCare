# ADR-0001: Start with a Modular Monolith

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The platform spans many business domains, but it is being built by a solo founder with AI assistance. Independent services would introduce deployment, networking, observability, data-consistency, and local-development costs before product-market fit.

## Decision

Build the initial platform as a modular monolith with explicit domain boundaries inside a single repository and primary deployment.

## Consequences

- Faster development and simpler operations.
- Transactions across related domains remain straightforward.
- Domain modules must avoid uncontrolled cross-imports and shared mutable models.
- High-load or independently evolving modules may be extracted later behind existing interfaces.

## Alternatives considered

- Microservices from the beginning
- Separate frontend and NestJS backend deployments
- Serverless functions for every domain operation
