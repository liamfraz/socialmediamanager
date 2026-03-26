---
phase: 2
slug: billing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + TypeScript compile checks |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must pass
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | BILL-01,02 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 2-01-02 | 01 | 1 | BILL-06 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 2-02-01 | 02 | 2 | BILL-01 | integration | `curl POST /api/billing/checkout` | N/A | ⬜ pending |
| 2-02-02 | 02 | 2 | BILL-03 | integration | `curl POST /api/billing/webhook` | N/A | ⬜ pending |
| 2-03-01 | 03 | 3 | BILL-04 | integration | `curl POST /api/billing/portal` | N/A | ⬜ pending |
| 2-03-02 | 03 | 3 | BILL-05 | compile | `npx tsc --noEmit` + grep | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Stripe test mode API keys configured in `.env`
- [ ] Stripe Products and Prices created in test dashboard

*These are external setup — no code changes needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe Checkout redirect and return | BILL-01 | Requires browser + Stripe test card | Click subscribe, use 4242424242424242, verify redirect back |
| Customer Portal access | BILL-04 | Requires browser + active subscription | Click manage billing, verify Stripe portal opens |
| Feature gating upgrade prompt | BILL-05 | Requires UI interaction | On free plan, try to access paid feature, verify prompt appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
