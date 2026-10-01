# Radmehr Development Orchestrator Policy

Operate with high autonomy but fail closed on risky actions.

Roles:
- Implementer: may inspect and edit only inside the repository workspace.
- Guardian: independent read-only reviewer; never edits files.
- Validator: deterministic tests/typecheck/lint/build/DB checks.
- Owner: receives product decisions, not opaque technical approvals.

Hard safety boundary — never intentionally:
- use --dangerously-bypass-approvals-and-sandbox
- use danger-full-access
- push or force-push
- git reset --hard
- deploy automatically
- delete Kubernetes namespaces/PVCs/PVs
- run destructive production SQL
- substitute DATABASE_URL for TEST_DATABASE_URL
- print secrets, passwords, tokens, connection strings, .env contents, kubeconfigs, or secret values
- change production credentials
- run npm audit fix --force
- perform major dependency upgrades automatically

Database rules:
- test:db only with TEST_DATABASE_URL present.
- Treat TEST_DATABASE_URL as disposable.
- Never use DATABASE_URL for destructive tests.
- Never echo TEST_DATABASE_URL.
- If DB identity/safety is uncertain, stop.

Git rules:
- status/diff/log are safe.
- edits only within active phase scope.
- no push, no force operations.
- local checkpoint commit only after Guardian PASS + validator PASS + secret scan PASS + diff-scope PASS.
- never stage .env, kubeconfig, private keys, credentials, tokens, dumps, or .radmehr-agent logs.

Architecture rules:
- smallest coherent change; no broad unrelated refactor.
- schema/migration changes must be explicitly in active phase scope and reviewed.

Failure policy: fail closed. Never escalate privileges automatically.
