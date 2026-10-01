# Roadmap

Phase 0 — Quality baseline: complete.

Phase 1 — PostgreSQL foundation: validated pending checkpoint.
Known validation from owner session: DB integration, catalog/invariants, check, and build passed. Runtime still uses JSON persistence.

Phase 2 — Authentication cutover:
- secure password hashing
- server-side sessions
- login/logout/session endpoints
- activation / forced password change / reset flow
- first SUPER_ADMIN bootstrap
- session invalidation
Constraints: no public registration; new accounts USER; api_access=false by default; preserve UI where practical; do not cut over quota/provider logic yet.

Phase 3 — Authorization/RBAC and domain migration.
Phase 4 — Atomic quota + paid generation.
Phase 5 — Storage + production hardening.
