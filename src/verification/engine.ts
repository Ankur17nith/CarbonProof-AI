import { LocalExplanationProvider, type ExplanationProvider } from './explanations.js';
import {
  FindingSeverity,
  RiskLevel,
  VerificationStatus,
  type FindingDraft,
  type ScoreBreakdownEntry,
  type VerificationFinding,
  type VerificationRequest,
  type VerificationResult,
  type VerificationValidationError,
} from './models.js';
import {
  createDefaultRuleRegistry,
  resolveVerificationConfig,
  type ResolvedVerificationConfig,
  type RuleContext,
  type VersionedRuleRegistry,
} from './rules.js';
import {
  compareText,
  isRecord,
  roundScore,
  shortHash,
  stableSerialize,
  toFiniteNumber,
} from './utils.js';

export interface VerificationEngineOptions {
  readonly registry?: VersionedRuleRegistry;
  readonly explanationProvider?: ExplanationProvider;
}

function validationErrors(input: unknown): VerificationValidationError[] {
  const errors: VerificationValidationError[] = [];
  if (!isRecord(input)) {
    return [
      { code: 'request-not-object', path: '', message: 'Verification request must be an object.' },
    ];
  }
  const project = input.project;
  if (!isRecord(project)) {
    errors.push({
      code: 'project-required',
      path: 'project',
      message: 'A project object is required.',
    });
  } else if (typeof project.id !== 'string' || project.id.trim().length === 0) {
    errors.push({
      code: 'project-id-required',
      path: 'project.id',
      message: 'Project id must be a non-empty string.',
    });
  }

  const evidence = input.evidence;
  if (!Array.isArray(evidence)) {
    errors.push({
      code: 'evidence-required',
      path: 'evidence',
      message: 'Evidence must be an array.',
    });
  } else {
    const ids = new Set<string>();
    evidence.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push({
          code: 'evidence-object-required',
          path: `evidence[${index}]`,
          message: 'Each evidence entry must be an object.',
        });
        return;
      }
      if (typeof item.id !== 'string' || item.id.trim().length === 0) {
        errors.push({
          code: 'evidence-id-required',
          path: `evidence[${index}].id`,
          message: 'Evidence id must be a non-empty string.',
        });
      } else if (ids.has(item.id)) {
        errors.push({
          code: 'duplicate-evidence-id',
          path: `evidence[${index}].id`,
          message: `Evidence id ${item.id} is repeated.`,
        });
      } else {
        ids.add(item.id);
      }
      if (typeof item.evidenceType !== 'string' || item.evidenceType.trim().length === 0) {
        errors.push({
          code: 'evidence-type-required',
          path: `evidence[${index}].evidenceType`,
          message: 'Evidence type must be a non-empty string.',
        });
      }
    });
  }

  if (isRecord(input.config)) {
    const tolerance = input.config.quantityTolerance;
    if (
      tolerance !== undefined &&
      (toFiniteNumber(tolerance) === null || (toFiniteNumber(tolerance) ?? -1) < 0)
    ) {
      errors.push({
        code: 'invalid-quantity-tolerance',
        path: 'config.quantityTolerance',
        message: 'Quantity tolerance must be a finite non-negative number.',
      });
    }
    if (isRecord(input.config.ruleWeights)) {
      for (const [ruleId, weight] of Object.entries(input.config.ruleWeights)) {
        if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
          errors.push({
            code: 'invalid-rule-weight',
            path: `config.ruleWeights.${ruleId}`,
            message: 'Rule weights must be finite non-negative numbers.',
          });
        }
      }
    }
    if (isRecord(input.config.severityMultipliers)) {
      for (const [severity, multiplier] of Object.entries(input.config.severityMultipliers)) {
        if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier < 0) {
          errors.push({
            code: 'invalid-severity-multiplier',
            path: `config.severityMultipliers.${severity}`,
            message: 'Severity multipliers must be finite non-negative numbers.',
          });
        }
      }
    }
    if (
      input.config.periodMatchMode !== undefined &&
      input.config.periodMatchMode !== 'exact' &&
      input.config.periodMatchMode !== 'contained'
    ) {
      errors.push({
        code: 'invalid-period-match-mode',
        path: 'config.periodMatchMode',
        message: 'Period match mode must be exact or contained.',
      });
    }
  }
  return errors;
}

function riskLevel(riskScore: number): RiskLevel {
  if (riskScore >= 67) {
    return RiskLevel.HIGH;
  }
  if (riskScore >= 34) {
    return RiskLevel.MEDIUM;
  }
  return RiskLevel.LOW;
}

function emptyResult(
  status: VerificationStatus,
  version: string,
  errors: readonly VerificationValidationError[],
  failureReason?: string,
): VerificationResult {
  const result: VerificationResult = {
    status,
    score: status === VerificationStatus.COMPLETED_NO_FINDINGS ? 100 : 0,
    riskScore: status === VerificationStatus.COMPLETED_NO_FINDINGS ? 0 : 100,
    riskLevel: status === VerificationStatus.COMPLETED_NO_FINDINGS ? RiskLevel.LOW : RiskLevel.HIGH,
    ruleSetVersion: version,
    findings: [],
    scoreBreakdown: [],
    validationErrors: errors,
  };
  return failureReason === undefined ? result : { ...result, failureReason };
}

function normaliseDraft(draft: FindingDraft): FindingDraft {
  return {
    ...draft,
    affectedEvidenceIds: [...new Set(draft.affectedEvidenceIds)].sort(),
    affectedFields: [...new Set(draft.affectedFields)].sort(),
  };
}

function enrichFinding(draft: FindingDraft, provider: ExplanationProvider): VerificationFinding {
  const normalized = normaliseDraft(draft);
  const fingerprint = shortHash(
    stableSerialize({
      ruleId: normalized.ruleId,
      deduplicationKey: normalized.deduplicationKey,
      affectedEvidenceIds: normalized.affectedEvidenceIds,
      affectedFields: normalized.affectedFields,
      observedValues: normalized.observedValues,
    }),
  );
  return {
    ...normalized,
    id: `finding-${fingerprint}`,
    fingerprint,
    explanation: provider.explain(normalized),
  };
}

function scoreFindings(
  findings: readonly VerificationFinding[],
  config: ResolvedVerificationConfig,
  ruleIds: readonly string[],
): {
  readonly score: number;
  readonly riskScore: number;
  readonly breakdown: readonly ScoreBreakdownEntry[];
} {
  const breakdown = ruleIds.map((ruleId) => {
    const ruleFindings = findings.filter((finding) => finding.ruleId === ruleId);
    const configuredWeight = config.ruleWeights[ruleId] ?? 0;
    const penalty = ruleFindings.reduce(
      (total, finding) =>
        total + configuredWeight * (config.severityMultipliers[finding.severity] ?? 0),
      0,
    );
    return {
      ruleId,
      findingCount: ruleFindings.length,
      configuredWeight,
      severityMultiplier:
        ruleFindings.length === 0
          ? 0
          : (config.severityMultipliers[ruleFindings[0]?.severity ?? FindingSeverity.INFO] ?? 0),
      penalty: Math.round(penalty * 100) / 100,
    };
  });
  const riskScore = roundScore(breakdown.reduce((total, entry) => total + entry.penalty, 0));
  return { score: 100 - riskScore, riskScore, breakdown };
}

export class VerificationEngine {
  public readonly registry: VersionedRuleRegistry;
  public readonly explanationProvider: ExplanationProvider;

  public constructor(options: VerificationEngineOptions = {}) {
    this.registry = options.registry ?? createDefaultRuleRegistry();
    this.explanationProvider = options.explanationProvider ?? new LocalExplanationProvider();
  }

  public verify(input: unknown): VerificationResult {
    const errors = validationErrors(input);
    if (errors.length > 0) {
      return emptyResult(VerificationStatus.VALIDATION_ERROR, this.registry.version, errors);
    }

    try {
      const request = input as VerificationRequest;
      const config = resolveVerificationConfig(request, this.registry);
      const context: RuleContext = {
        request,
        project: request.project,
        evidence: [...request.evidence].sort((left, right) => compareText(left.id, right.id)),
        config,
      };
      const drafts: FindingDraft[] = [];
      const seen = new Set<string>();
      for (const rule of this.registry.rules) {
        if (!config.enabledRuleIds.has(rule.id)) {
          continue;
        }
        const evaluated = rule.evaluate(context);
        for (const item of evaluated) {
          const normalized = normaliseDraft(item);
          const key = `${normalized.ruleId}:${normalized.deduplicationKey}`;
          if (!seen.has(key)) {
            seen.add(key);
            drafts.push(normalized);
          }
        }
      }

      const findings = drafts
        .map((item) => enrichFinding(item, this.explanationProvider))
        .sort(
          (left, right) =>
            compareText(left.ruleId, right.ruleId) ||
            compareText(left.deduplicationKey, right.deduplicationKey),
        );
      const score = scoreFindings(
        findings,
        config,
        this.registry.rules.map((rule) => rule.id),
      );
      const status =
        findings.length === 0
          ? VerificationStatus.COMPLETED_NO_FINDINGS
          : VerificationStatus.COMPLETED_WITH_FINDINGS;
      return {
        status,
        score: score.score,
        riskScore: score.riskScore,
        riskLevel: riskLevel(score.riskScore),
        ruleSetVersion: this.registry.version,
        findings,
        scoreBreakdown: score.breakdown,
        validationErrors: [],
      };
    } catch {
      return emptyResult(
        VerificationStatus.FAILED,
        this.registry.version,
        [],
        'Verification could not be completed because a rule evaluation failed.',
      );
    }
  }
}

export function verify(
  input: unknown,
  options: VerificationEngineOptions = {},
): VerificationResult {
  return new VerificationEngine(options).verify(input);
}

export function createVerificationEngine(
  options: VerificationEngineOptions = {},
): VerificationEngine {
  return new VerificationEngine(options);
}

export const runVerification = verify;
