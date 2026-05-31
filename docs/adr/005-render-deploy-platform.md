# ADR-005: Use of Render for Payments in Development

## Status

Accepted

## Date

2026-05-26

## Context

We need a hosting platform to deploy the payment-related services. Render is chosen because it supports deploying Go services that handle file uploads, which we need for this project.

## Decision

Use Render for deployment of the payment services because it allows uploading files with Go.

## Consequences

- Deployment supports the Go stack and file upload requirements.
- The setup aligns with the project needs without extra infrastructure.

