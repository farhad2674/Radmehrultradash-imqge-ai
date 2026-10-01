# Phase 2 — Authentication cutover

Inspect existing Phase 1 DB schema and current Express/runtime before editing.
Implement the smallest secure coherent authentication slice:
- password hashing suitable for Node
- server-side session storage using Phase 1 sessions table
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/session
- account activation / initial credential flow
- password change flow
- secure first-SUPER_ADMIN bootstrap path
- session expiry/invalidation matching 8-hour idle / 7-day absolute policy

Security expectations:
- no plaintext password storage or credential logging
- secure production cookie behavior with explicit development behavior
- request validation
- generic login failures
- safe password verification
- session tokens protected at rest where practical
- preserve last SUPER_ADMIN protections
- no public self-registration
- new users remain USER and api_access=false
- do not implement paid generation/quota cutover yet
- do not broadly switch unrelated JSON persistence
- do not redesign frontend

Add focused auth tests, preserve all existing tests, use TEST_DATABASE_URL exclusively for destructive DB integration, and make no real provider calls.
Stop rather than widening architecture silently if the schema cannot support a secure implementation.
