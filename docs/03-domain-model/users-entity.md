# Users Entity Specification

Module: Identity

Status: Approved

Version: 1.0

---

# Business Purpose

The Users entity represents a human identity within the Nahu Platform.

A user can authenticate to the platform and may perform one or more business roles within one or more organizations.

The Users entity does not contain business-specific information such as farms, cooperatives, warehouses, or export licenses.

Those belong to other business modules.

---

# Responsibilities

The Users entity is responsible for:

- Identifying a person
- Storing basic profile information
- Recording language preference
- Managing account lifecycle status

The Users entity is NOT responsible for:

- Authentication credentials
- Roles
- Permissions
- Organizations
- Addresses
- Business profiles

---

# Fields

| Field | Required | Description |
|--------|----------|-------------|
| id | Yes | Unique UUID |
| first_name | Yes | Given name |
| middle_name | Yes | Father's name |
| last_name | No | Family name |
| phone | Yes | Primary login identifier |
| email | No | Secondary contact |
| preferred_language | Yes | User interface language |
| status | Yes | Account lifecycle |
| phone_verified | Yes | Phone verification status |
| email_verified | Yes | Email verification status |
| created_at | Yes | Creation timestamp |
| updated_at | Yes | Last modification timestamp |
| deleted_at | No | Soft delete timestamp |

---

# Relationships

A User:

- has one Credentials record
- can have many Roles
- can belong to many Organizations
- can have many Sessions
- can have many Devices
- can have many Login History records

---

# Architecture Decisions

- Multiple roles per user
- Multiple organizations per user
- Phone-first authentication
- Credentials stored separately
- Canonical data with localized presentation
- Ethiopian naming convention