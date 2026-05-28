# ADR-003: Use of Supabase for Database Deployment

## Status

Accepted

## Date

2026-03-17

## Context

We need a managed deployment environment for PostgreSQL that simplifies maintenance, scaling, and routine operations (backups, monitoring, and secure access), reducing the team's operational burden.

## Decision

Use Supabase as the managed platform to deploy and operate the PostgreSQL database.

## Consequences

- Operational burden is reduced by delegating maintenance and backups.
- Standardized configuration and secure access are provided with integrated tools.
- We depend on a third-party provider for availability and service limits.
