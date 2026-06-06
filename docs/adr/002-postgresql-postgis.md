# ADR-002: Use of PostgreSQL with PostGIS

## Status

Superseded by [ADR-007: Use of PostgreSQL without PostGIS](007-postgresql-without-postgis.md)  due to changes in product scope and removal of location-based features from the roadmap.

## Date

2026-03-17

## Context

We need a database that models relationships between domain entities (users, products, rentals, payments) and supports consistent queries. We also need geospatial capabilities for location and proximity searches.

## Decision

Use PostgreSQL as the relational database and enable the PostGIS plugin for geospatial operations.

## Consequences

- Relational modeling and referential integrity are simplified.
- Advanced geospatial queries (distance, area, proximity) are enabled with PostGIS.
- Requires managing PostgreSQL extensions in the deployment environment.
