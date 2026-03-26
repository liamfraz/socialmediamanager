---
phase: 1
slug: infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + curl/API checks |
| **Config file** | none — no test framework in project yet |
| **Quick run command** | `curl -s -o /dev/null -w "%{http_code}" http://localhost:5050` |
| **Full suite command** | `npm run build && npm run start` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick check (server starts, responds 200)
- **After every plan wave:** Run full build + start
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-01 | integration | `curl -s http://localhost:5050/api/health` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INFRA-02 | integration | `node -e "require('@aws-sdk/client-s3')"` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | INFRA-03 | manual | Check existing images load via R2 URLs | N/A | ⬜ pending |
| 1-02-02 | 02 | 1 | INFRA-04 | integration | Upload image, verify R2 URL returned | N/A | ⬜ pending |
| 1-03-01 | 03 | 2 | INFRA-05 | integration | `npm run build` exits 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Health endpoint at `/api/health` — returns 200 with session and storage status
- [ ] R2 bucket created and accessible with test credentials

*Existing infrastructure covers most requirements — Wave 0 is minimal.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across server restart | INFRA-01 | Requires browser interaction | Log in, restart server, refresh page — should still be logged in |
| Existing images accessible after migration | INFRA-03 | Requires visual verification | Browse tagged photos page, verify all images load |
| Deploy to Railway/Fly.io | INFRA-05 | Requires external service | Deploy, verify app starts and serves traffic |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
