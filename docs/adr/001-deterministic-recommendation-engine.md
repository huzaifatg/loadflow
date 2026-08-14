# ADR-001: Deterministic Recommendation Engine

**Status:** Accepted  
**Date:** 2026-07-22  
**Context:** Sprint 13.1 — Recommendation Engine

## Decision

The recommendation engine uses a deterministic weighted-factor scoring model instead of a machine learning model or LLM.

## Context

When building the truck/driver recommendation feature, we had three options:

1. **LLM-based** (GPT/Claude/Gemini) — natural language explanations, but non-deterministic, slow, expensive, requires external API.
2. **ML model** — trainable on historical data, but requires training data we don't have yet, complex deployment.
3. **Deterministic scoring** — weighted factor sum with bell curves, fully explainable, instant, zero external dependencies.

## Rationale

- **Dispatcher trust:** Logistics dispatchers need to understand why a truck was recommended. A deterministic model produces the same output for the same input, every time. The dispatcher can verify the reasoning.
- **Auditability:** Enterprise customers require audit trails. A scoring model with explicit factor breakdowns is inherently auditable.
- **No external dependencies:** The engine is a pure function — no API calls, no network latency, no cost per request.
- **Extensibility:** New scoring factors can be added by implementing a scoring function and adding a weight. The architecture supports this without redesign.
- **Future ML path:** The pure function interface (`RecommendationInput → RecommendationResult`) can be swapped for an ML model later without changing the API or UI layer.

## Consequences

- The engine cannot learn from historical dispatcher decisions (yet). Custom weights can approximate this.
- Very complex routing scenarios (multi-stop optimization) are not well-served by factor scoring alone.
- The bell-curve capacity fit model favors ~80% utilization, which may not be optimal for all fleet types.
