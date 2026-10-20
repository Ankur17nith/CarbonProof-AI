# Verification rules

The default registry is `carbonproof-verification-rules@1.0.0`. The engine sorts
evidence by ID, evaluates enabled rules, deduplicates each rule/finding key, and
creates stable finding IDs from a content fingerprint.

Implemented rules:

1. Required evidence missing.
2. Project identifier mismatch.
3. Reporting-period inconsistency.
4. Invalid reporting-period boundaries.
5. Unit mismatch.
6. Quantity inconsistency.
7. Duplicate evidence hash.
8. Duplicate external reference.
9. Malformed structured evidence.
10. Missing source provenance.
11. Invalid numeric values.
12. Suspicious repeated evidence references.
13. Contradictory structured claims where both values exist.
14. Credit quantity/lifecycle inconsistency.

The default rule weights are in `src/verification/rules.ts`. Each finding gets a
severity multiplier: INFO `0`, LOW `0.25`, MEDIUM `0.5`, HIGH `0.75`, CRITICAL
`1`. The risk score is the sum of penalties, rounded and capped at 100. The
prioritization score is `100 - riskScore`. Risk levels are LOW `<34`, MEDIUM
`34..66`, and HIGH `>=67`.

The engine returns `VALIDATION_ERROR` for malformed requests,
`COMPLETED_WITH_FINDINGS` when configured rules find issues,
`COMPLETED_NO_FINDINGS` when no rule fails, and `FAILED` if a rule evaluation
unexpectedly fails. Scores do not prove fraud, credit validity, or emissions
reductions.

Rule changes must create a new rule-set version and preserve the old version so
historical assessments remain explainable.
