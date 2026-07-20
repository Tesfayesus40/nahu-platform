# Cursor Rules for Nahu Platform

## Mission

You are developing the Nahu Platform, an enterprise agricultural marketplace for Ethiopia.

Always prioritize maintainability, scalability, security, and clean architecture.

## Documentation First

Before writing or modifying code, consult the relevant documentation in `/docs`.

Priority:

1. docs/01-business
2. docs/02-architecture
3. docs/03-domain-model
4. docs/04-requirements
5. docs/05-api
6. docs/06-database
7. docs/07-decisions
8. docs/08-guides

Never contradict documented architecture without explaining why.

## Coding Principles

- Prefer modifying existing code over creating duplicate implementations.
- Keep modules cohesive.
- Keep controllers thin.
- Put business logic into services.
- Reuse existing utilities.
- Write readable, maintainable code.
- Avoid unnecessary complexity.

## Database

- Never modify production schema without migrations.
- Preserve data integrity.
- Explain any migration before generating it.

## APIs

- Preserve backward compatibility.
- Use consistent response formats.
- Validate all inputs.

## Safety

Before making major architectural or database changes:

1. Explain the proposed change.
2. Explain the reason.
3. Wait for approval.