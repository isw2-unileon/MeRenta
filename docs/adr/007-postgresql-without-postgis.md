# ADR-007: Use of PostgreSQL without PostGIS

## Status

Accepted

## Date

2026-06-01

## Context

In ADR-002, we decided to use PostgreSQL with the PostGIS extension to support geospatial and proximity features. However, during recent project refinement, the product scope changed, and all location-based features have been removed from the roadmap.

## Decision

We will use standard PostgreSQL as our relational database and **will not enable** or install the PostGIS extension.

## Consequences

- **Positive:** Reduced infrastructure complexity. We don't need to manage, update, or tune geospatial extensions in our database clusters.
- **Positive:** Lower memory and CPU footprint on the database server.
- **Neutral:** Relational modeling and referential integrity for core entities (users, products, rentals, payments) remain unchanged as decided in ADR-002.
- **Negative/Risk:** If geospatial features are re-introduced in the future, we will need to re-evaluate and run migrations to enable the extension.
