# ADR-002: Separation of Recommendation and Optimization

**Status:** Accepted  
**Date:** 2026-07-22  
**Context:** Sprint 13.1

## Decision

Recommendation and Route Optimization are separate features with distinct API endpoints, engines, and UI pages.

## Context

Both features help dispatchers assign deliveries to trucks, but they solve different problems:

- **Recommendation** answers: "Which single truck and driver is best for this batch of deliveries?"
- **Optimization** answers: "How should all pending deliveries be distributed across all available trucks?"

## Rationale

- **Different algorithms:** Recommendation uses a scoring model (weighted factor sum). Optimization uses bin-packing (First Fit Decreasing). Combining them would create a monolithic engine that's harder to test and maintain.
- **Different use cases:** A dispatcher may want to optimize the full day's plan (optimization), or evaluate one specific batch (recommendation). These are distinct user intents.
- **Independent evolution:** Recommendation can later evolve to include ML. Optimization can later include geographic clustering. Keeping them separate allows independent iteration.
- **Testability:** Each engine is a pure function with its own test suite. Combined, the test matrix would be much larger.

## Consequences

- Some code duplication in data fetching (both need trucks, drivers, deliveries). This is acceptable because the transformations differ.
- Users must choose which feature to use. The UI provides clear navigation to both.
