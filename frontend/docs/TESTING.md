# CarbonProof AI — Frontend Testing & Quality Assurance

This document details the test architecture, test suites, coverage areas, and quality checks established for the CarbonProof AI frontend.

---

## 1. Test Architecture

The frontend uses **Vitest 2.1** with **React Testing Library** and **@testing-library/jest-dom** in a `jsdom` simulated browser environment.

- **Test Runner**: Vitest (`vitest run` for CI, `vitest` for interactive watch)
- **Component Harness**: Custom `renderWithProviders` wrapping with `QueryClientProvider`, `AuthProvider`, and `MemoryRouter`
- **Mocks & Spies**: Vitest native `vi.fn()` and `vi.mock()` for API calls and window APIs (`matchMedia`, `scrollTo`)
- **Type Checking**: Full TypeScript compiler typecheck (`tsc -b` and `tsc --noEmit`)

---

## 2. Test Suites Overview

| Suite File | Scope & Tested Behaviors | Tests |
|---|---|---|
| `src/test/format.test.ts` | Date formatting, large numbers, BigInt handling, SHA-256 hash truncation with ellipsis, file size calculation, badge status mappings, blockchain status mappings | 8 tests |
| `src/test/components.test.tsx` | UI Primitives: Button variants & loading spinners, Badge semantic colors, Card layouts, Input with ARIA labels & hints, Select options change handling, Modal keyboard dismiss & accessibility | 7 tests |
| `src/test/auth.test.tsx` | Authentication: Anonymous initialization, session persistence in sessionStorage, role extraction, token clearing on logout | 3 tests |
| `src/test/navigation.test.tsx` | Layout & RBAC: Sidebar navigation rendering, role-based link filtering (Review Queue visible for REVIEWER, hidden for CONTRIBUTOR), Header environment badge and user chip | 3 tests |
| `src/test/features.test.tsx` | Critical User Journeys: Login page quick-role selection chips filling inputs, Public Verification portal zero-trust search input & button | 2 tests |

**Total passing tests**: 23 tests across 5 test suites.

---

## 3. Running Test Suites

```bash
# Run all frontend tests once
npm run test

# Run specific suite
npx vitest run src/test/components.test.tsx

# Run with test coverage
npx vitest run --coverage
```

---

## 4. End-to-End & Integration Validation

In addition to Vitest unit/component tests, the frontend was verified against:
1. **Production Bundle Compilation**: Executed `npm run build` (`tsc -b && vite build`) to confirm zero JSX/TS type errors and clean asset generation (`dist/index.html`, `dist/assets/`).
2. **Accessibility Verification**: Tested `<main id="main-content">` landmark, skip-links, ARIA dialog roles, focus management on modals, and form field label associations.
3. **Responsive Layouts**: Verified responsive desktop sidebar navigation and mobile overlay behavior.
