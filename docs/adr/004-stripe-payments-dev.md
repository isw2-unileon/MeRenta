# ADR-004: Use of Stripe for Payments in Development

## Status

Accepted

## Date

2026-03-20

## Context

We need a payment provider to validate the payment flow end to end during development. Because this is an academic project without real payment traffic, we must avoid handling live transactions while still testing the integration.

## Decision

Use Stripe in development mode (test environment) for payment processing.

## Consequences

- The team can test payment flows without real charges.
- No live payment traffic is processed, aligning with the academic scope.
- Production payment readiness would require switching to live keys and compliance checks.

