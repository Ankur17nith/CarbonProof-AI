import { describe, expect, it } from 'vitest';
import {
  FindingSeverity,
  LocalExplanationProvider,
  VerificationEngine,
  VerificationRuleId,
  VerificationStatus,
  VerificationRuleRegistry,
  createDefaultRuleRegistry,
  type FindingDraft,
  type VerificationEvidence,
  type VerificationRequest,
} from '../src/verification/index.js';

const projectPeriod = { start: '2026-01-01T00:00:00.000Z', end: '2026-12-31T23:59:59.999Z' };

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    externalProjectId: 'registry-project-1',
    reportingPeriod: projectPeriod,
    unit: 'tCO2e',
    quantity: 10,
    requiredEvidenceTypes: ['monitoring'],
    ...overrides,
  };
}

function evidence(id: string, overrides: Record<string, unknown> = {}): VerificationEvidence {
  return {
    id,
    evidenceType: 'monitoring',
    projectId: 'project-1',
    sha256: `hash-${id}`,
    externalReference: `external-${id}`,
    reportingPeriod: projectPeriod,
    unit: 'tCO2e',
    quantity: 10,
    provenance: { type: 'PRIMARY_SOURCE', source: `source-${id}` },
    ...overrides,
  };
}

function request(
  evidenceItems: readonly VerificationEvidence[] = [evidence('evidence-1')],
  projectOverrides: Record<string, unknown> = {},
  config: VerificationRequest['config'] = {},
): VerificationRequest {
  return { project: project(projectOverrides), evidence: evidenceItems, config };
}

function resultForRule(ruleId: VerificationRuleId, input: VerificationRequest) {
  return new VerificationEngine().verify({
    ...input,
    config: { ...input.config, enabledRuleIds: [ruleId] },
  });
}

function ruleIds(result: ReturnType<VerificationEngine['verify']>): string[] {
  return result.findings.map((finding) => finding.ruleId);
}

describe('CarbonProof verification domain', () => {
  it('registers every requested rule in a versioned default registry', () => {
    const registry = createDefaultRuleRegistry();

    expect(registry.version).toBe('carbonproof-verification-rules@1.0.0');
    expect(registry.rules.map((rule) => rule.id)).toEqual([
      VerificationRuleId.REQUIRED_EVIDENCE_MISSING,
      VerificationRuleId.PROJECT_IDENTIFIER_MISMATCH,
      VerificationRuleId.REPORTING_PERIOD_INCONSISTENCY,
      VerificationRuleId.INVALID_BOUNDARIES,
      VerificationRuleId.UNIT_MISMATCH,
      VerificationRuleId.QUANTITY_INCONSISTENCY,
      VerificationRuleId.DUPLICATE_EVIDENCE_HASH,
      VerificationRuleId.DUPLICATE_EXTERNAL_REFERENCE,
      VerificationRuleId.MALFORMED_STRUCTURED_EVIDENCE,
      VerificationRuleId.MISSING_PROVENANCE,
      VerificationRuleId.INVALID_NUMERIC_VALUES,
      VerificationRuleId.REPEATED_EVIDENCE_REFERENCES,
      VerificationRuleId.CONTRADICTORY_STRUCTURED_CLAIMS,
      VerificationRuleId.CREDIT_QUANTITY_INCONSISTENCY,
    ]);
  });

  it('reports missing required evidence', () => {
    const result = resultForRule(
      VerificationRuleId.REQUIRED_EVIDENCE_MISSING,
      request([], { requiredEvidence: [{ evidenceType: 'verification', minimumCount: 1 }] }),
    );

    expect(result.status).toBe(VerificationStatus.COMPLETED_WITH_FINDINGS);
    expect(ruleIds(result)).toEqual([VerificationRuleId.REQUIRED_EVIDENCE_MISSING]);
    expect(result.findings[0]?.observedValues).toEqual({
      evidenceType: 'verification',
      observedCount: 0,
      requiredCount: 1,
    });
  });

  it('detects a project identifier mismatch', () => {
    const result = resultForRule(
      VerificationRuleId.PROJECT_IDENTIFIER_MISMATCH,
      request([evidence('evidence-1', { projectId: 'project-2' })]),
    );

    expect(ruleIds(result)).toEqual([VerificationRuleId.PROJECT_IDENTIFIER_MISMATCH]);
    expect(result.findings[0]?.affectedEvidenceIds).toEqual(['evidence-1']);
  });

  it('detects reporting period inconsistency', () => {
    const result = resultForRule(
      VerificationRuleId.REPORTING_PERIOD_INCONSISTENCY,
      request([
        evidence('evidence-1', {
          reportingPeriod: {
            start: '2026-01-01T00:00:00.000Z',
            end: '2027-01-01T00:00:00.000Z',
          },
        }),
      ]),
    );

    expect(ruleIds(result)).toEqual([VerificationRuleId.REPORTING_PERIOD_INCONSISTENCY]);
  });

  it('detects invalid reporting boundaries', () => {
    const result = resultForRule(
      VerificationRuleId.INVALID_BOUNDARIES,
      request([], {
        reportingPeriod: { start: '2026-12-31T00:00:00.000Z', end: '2026-01-01T00:00:00.000Z' },
      }),
    );

    expect(ruleIds(result)).toEqual([VerificationRuleId.INVALID_BOUNDARIES]);
    expect(result.findings[0]?.affectedFields).toEqual([
      'reportingPeriod.end',
      'reportingPeriod.start',
    ]);
  });

  it('detects unit mismatch after normalizing equivalent unit spellings', () => {
    const equivalent = resultForRule(
      VerificationRuleId.UNIT_MISMATCH,
      request([evidence('evidence-1', { unit: 'tonnes CO2e' })]),
    );
    const mismatch = resultForRule(
      VerificationRuleId.UNIT_MISMATCH,
      request([evidence('evidence-1', { unit: 'kg' })]),
    );

    expect(equivalent.findings).toHaveLength(0);
    expect(ruleIds(mismatch)).toEqual([VerificationRuleId.UNIT_MISMATCH]);
  });

  it('detects quantity inconsistency and supports a configured tolerance', () => {
    const mismatch = resultForRule(
      VerificationRuleId.QUANTITY_INCONSISTENCY,
      request([evidence('evidence-1', { quantity: 9 })]),
    );
    const withinTolerance = resultForRule(
      VerificationRuleId.QUANTITY_INCONSISTENCY,
      request([evidence('evidence-1', { quantity: 9.5 })], {}, { quantityTolerance: 0.5 }),
    );

    expect(ruleIds(mismatch)).toEqual([VerificationRuleId.QUANTITY_INCONSISTENCY]);
    expect(withinTolerance.findings).toHaveLength(0);
  });

  it('detects duplicate evidence hashes as one grouped finding', () => {
    const result = resultForRule(
      VerificationRuleId.DUPLICATE_EVIDENCE_HASH,
      request([
        evidence('evidence-b', { sha256: 'same-hash' }),
        evidence('evidence-a', { sha256: 'same-hash' }),
        evidence('evidence-c', { sha256: 'different-hash' }),
      ]),
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.affectedEvidenceIds).toEqual(['evidence-a', 'evidence-b']);
  });

  it('detects duplicate external references', () => {
    const result = resultForRule(
      VerificationRuleId.DUPLICATE_EXTERNAL_REFERENCE,
      request([
        evidence('evidence-a', { externalReference: 'registry-ref-1' }),
        evidence('evidence-b', { externalReference: 'registry-ref-1' }),
      ]),
    );

    expect(ruleIds(result)).toEqual([VerificationRuleId.DUPLICATE_EXTERNAL_REFERENCE]);
  });

  it('detects malformed structured evidence', () => {
    const result = resultForRule(
      VerificationRuleId.MALFORMED_STRUCTURED_EVIDENCE,
      request([evidence('evidence-1', { structuredData: ['not', 'an', 'object'] })]),
    );

    expect(ruleIds(result)).toEqual([VerificationRuleId.MALFORMED_STRUCTURED_EVIDENCE]);
  });

  it('detects missing provenance without treating an empty record as provenance', () => {
    const result = resultForRule(
      VerificationRuleId.MISSING_PROVENANCE,
      request([evidence('evidence-1', { provenance: {} })]),
    );

    expect(ruleIds(result)).toEqual([VerificationRuleId.MISSING_PROVENANCE]);
  });

  it('detects invalid, non-finite, and negative numeric values', () => {
    const invalidString = resultForRule(
      VerificationRuleId.INVALID_NUMERIC_VALUES,
      request([evidence('evidence-1', { quantity: 'not-a-number' })]),
    );
    const nonFinite = resultForRule(
      VerificationRuleId.INVALID_NUMERIC_VALUES,
      request([evidence('evidence-1', { quantity: Number.NaN })]),
    );
    const negative = resultForRule(
      VerificationRuleId.INVALID_NUMERIC_VALUES,
      request([evidence('evidence-1', { quantity: -1 })]),
    );

    expect(invalidString.findings).toHaveLength(1);
    expect(nonFinite.findings).toHaveLength(1);
    expect(negative.findings).toHaveLength(1);
  });

  it('detects repeated evidence references across reference fields once', () => {
    const result = resultForRule(
      VerificationRuleId.REPEATED_EVIDENCE_REFERENCES,
      request([
        evidence('evidence-a', { references: ['source-1', 'source-1'] }),
        evidence('evidence-b', { evidenceReferences: [{ evidenceId: 'source-1' }] }),
      ]),
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.affectedEvidenceIds).toEqual(['evidence-a', 'evidence-b']);
  });

  it('detects contradictory structured claims when known fields exist', () => {
    const result = resultForRule(
      VerificationRuleId.CONTRADICTORY_STRUCTURED_CLAIMS,
      request([evidence('evidence-1', { structuredData: { quantity: 9, unit: 'tCO2e' } })]),
    );

    expect(ruleIds(result)).toEqual([VerificationRuleId.CONTRADICTORY_STRUCTURED_CLAIMS]);
    expect(result.findings[0]?.affectedFields).toEqual(['quantity', 'structuredData']);
  });

  it('detects credit quantity inconsistencies in totals and lifecycle events', () => {
    const result = resultForRule(
      VerificationRuleId.CREDIT_QUANTITY_INCONSISTENCY,
      request([], {
        credit: {
          totalQuantity: 9,
          issuedQuantity: 8,
          retiredQuantity: 4,
          events: [
            { type: 'issued', quantity: 7 },
            { type: 'retired', quantity: 4 },
          ],
        },
      }),
    );

    expect(result.findings.map((finding) => finding.deduplicationKey)).toEqual([
      'project.credit:events:issued',
      'project.credit:lifecycle-total',
      'total:project',
    ]);
  });

  it('returns a clean deterministic result with score 100', () => {
    const input = request();
    const first = new VerificationEngine().verify(input);
    const second = new VerificationEngine().verify(input);

    expect(first).toEqual(second);
    expect(first.status).toBe(VerificationStatus.COMPLETED_NO_FINDINGS);
    expect(first.score).toBe(100);
    expect(first.riskScore).toBe(0);
    expect(first.findings).toEqual([]);
  });

  it('is repeatable even when evidence input order changes', () => {
    const first = new VerificationEngine().verify(
      request([
        evidence('evidence-b', { sha256: 'same', externalReference: 'same-ref' }),
        evidence('evidence-a', { sha256: 'same', externalReference: 'same-ref', quantity: 9 }),
      ]),
    );
    const second = new VerificationEngine().verify(
      request([
        evidence('evidence-a', { sha256: 'same', externalReference: 'same-ref', quantity: 9 }),
        evidence('evidence-b', { sha256: 'same', externalReference: 'same-ref' }),
      ]),
    );

    expect(first).toEqual(second);
    expect(first.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^finding-[0-9a-f]{8}$/)]),
    );
  });

  it('supports configurable rule enablement, weights, and deterministic explanations', () => {
    const engine = new VerificationEngine({ explanationProvider: new LocalExplanationProvider() });
    const disabled = engine.verify({
      ...request([evidence('evidence-1', { unit: 'kg' })]),
      config: { enabledRuleIds: [VerificationRuleId.REQUIRED_EVIDENCE_MISSING] },
    });
    const weighted = engine.verify({
      ...request([evidence('evidence-1', { unit: 'kg' })]),
      config: {
        enabledRuleIds: [VerificationRuleId.UNIT_MISMATCH],
        ruleWeights: { [VerificationRuleId.UNIT_MISMATCH]: 50 },
        severityMultipliers: { [FindingSeverity.HIGH]: 1 },
      },
    });

    expect(disabled.findings).toEqual([]);
    expect(weighted.score).toBe(50);
    expect(weighted.findings[0]?.explanation).toContain('Expected:');
  });

  it('returns validation errors for invalid request shape', () => {
    const result = new VerificationEngine().verify({ project: { id: 'project-1' } });

    expect(result.status).toBe(VerificationStatus.VALIDATION_ERROR);
    expect(result.validationErrors.map((error) => error.code)).toContain('evidence-required');
    expect(result.findings).toEqual([]);
  });

  it('returns FAILED when a custom rule throws', () => {
    const throwingRule = {
      id: 'custom-throwing-rule',
      version: '1.0.0',
      defaultWeight: 1,
      evaluate: (): readonly FindingDraft[] => {
        throw new Error('test failure');
      },
    };
    const registry = new VerificationRuleRegistry('custom@1.0.0', [throwingRule]);
    const result = new VerificationEngine({ registry }).verify(request());

    expect(result.status).toBe(VerificationStatus.FAILED);
    expect(result.failureReason).toBe(
      'Verification could not be completed because a rule evaluation failed.',
    );
  });
});
