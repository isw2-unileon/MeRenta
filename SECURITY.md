# Security Policy

## Scope

This security policy applies to all versions of the project 
currently maintained. The goal is to ensure the integrity, 
confidentiality and availability of the application 
and its users' data.

## Reporting a Vulnerability

If you find a security issue in the code, 
please open an **issue** in this repository including:

- Description of the vulnerability
- Steps to reproduce it
- Potential impact

## Security Best Practices

- No credentials are stored in the source code.
- Sensitive variables are managed through `.env` files.
- The `.gitignore` file excludes sensitive files.
- Dependencies are kept up to date.
