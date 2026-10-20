import {
  FindingSeverity,
  type CreditEvent,
  type CreditBatchClaim,
  type CreditQuantityClaim,
  type EvidenceReference,
  type FindingDraft,
  type VerificationConfig,
  type VerificationEvidence,
  type VerificationProject,
  type VerificationRequest,
  type PeriodMatchMode,
} from './models.js';
import {
  compareText,
  isPresent,
  isRecord,
  normaliseText,
  normaliseUnit,
  parseDateValue,
  stableSerialize,
  toFiniteNumber,
  toJsonValue,
} from './utils.js';

export interface ResolvedVerificationConfig {
  readonly requiredEvidence: readonly {
    readonly evidenceType: string;
    readonly minimumCount: number;
  }[];
  readonly enabledRuleIds: ReadonlySet<string>;
  readonly ruleWeights: Readonly<Record<string, number>>;
  readonly severityMultipliers: Readonly<Record<FindingSeverity, number>>;
  readonly quantityTolerance: number;
  readonly periodMatchMode: PeriodMatchMode;
}

export interface RuleContext {
  readonly request: VerificationRequest;
  readonly project: VerificationProject;
  readonly evidence: readonly VerificationEvidence[];
  readonly config: ResolvedVerificationConfig;
}

export interface VerificationRule {
  readonly id: string;
  readonly version: string;
  readonly defaultWeight: number;
  evaluate(context: RuleContext): readonly FindingDraft[];
}

export interface VersionedRuleRegistry {
  readonly version: string;
  readonly rules: readonly VerificationRule[];
  getRule(id: string): VerificationRule | undefined;
}

const DEFAULT_WEIGHTS: Readonly<Record<string, number>> = {
  'required-evidence-missing': 20,
  'project-identifier-mismatch': 12,
  'reporting-period-inconsistency': 10,
  'invalid-boundaries': 14,
  'unit-mismatch': 10,
  'quantity-inconsistency': 12,
  'duplicate-evidence-hash': 8,
  'duplicate-external-reference': 8,
  'malformed-structured-evidence': 12,
  'missing-provenance': 8,
  'invalid-numeric-values': 14,
  'repeated-evidence-references': 7,
  'contradictory-structured-claims': 12,
  'credit-quantity-inconsistency': 14,
};

function defaultWeight(ruleId: string): number {
  return DEFAULT_WEIGHTS[ruleId] ?? 0;
}

export const DEFAULT_SEVERITY_MULTIPLIERS: Readonly<Record<FindingSeverity, number>> = {
  [FindingSeverity.INFO]: 0,
  [FindingSeverity.LOW]: 0.25,
  [FindingSeverity.MEDIUM]: 0.5,
  [FindingSeverity.HIGH]: 0.75,
  [FindingSeverity.CRITICAL]: 1,
};

function draft(
  ruleId: string,
  severity: FindingSeverity,
  category: string,
  title: string,
  message: string,
  deduplicationKey: string,
  affectedEvidenceIds: readonly string[] = [],
  affectedFields: readonly string[] = [],
  observedValues?: unknown,
  expectedCondition = 'The submitted project and evidence must satisfy this verification rule.',
  recommendation = 'Review the affected records and correct or replace the inconsistent evidence.',
): FindingDraft {
  const result: FindingDraft = {
    ruleId,
    severity,
    category,
    title,
    message,
    affectedEvidenceIds: [...affectedEvidenceIds].sort(),
    affectedFields: [...affectedFields].sort(),
    expectedCondition,
    recommendation,
    deduplicationKey,
  };
  if (observedValues !== undefined) {
    return { ...result, observedValues: toJsonValue(observedValues) };
  }
  return result;
}

function getPeriod(value: VerificationProject | VerificationEvidence): {
  readonly start: unknown;
  readonly end: unknown;
  readonly present: boolean;
} {
  const nested = value.reportingPeriod;
  const start = nested?.start ?? value.reportingPeriodStart;
  const end = nested?.end ?? value.reportingPeriodEnd;
  return { start, end, present: isPresent(start) || isPresent(end) };
}

function periodValues(value: VerificationProject | VerificationEvidence): {
  readonly start: number;
  readonly end: number;
} | null {
  const period = getPeriod(value);
  if (!period.present) {
    return null;
  }
  const start = parseDateValue(period.start);
  const end = parseDateValue(period.end);
  return start === null || end === null ? null : { start, end };
}

function evidenceIdentifierValues(
  project: VerificationProject,
  evidence: VerificationEvidence,
): string[] {
  const identifiers = [evidence.projectId, evidence.projectIdentifier, evidence.externalProjectId]
    .map((value) => normaliseText(value))
    .filter((value): value is string => value !== null);
  const expected = [project.id, project.externalProjectId, project.projectIdentifier]
    .map((value) => normaliseText(value))
    .filter((value): value is string => value !== null);
  return identifiers.filter((value) => !expected.includes(value));
}

function evidenceHash(evidence: VerificationEvidence): string | null {
  return normaliseText(evidence.sha256 ?? evidence.evidenceHash);
}

function externalReference(evidence: VerificationEvidence): string | null {
  return normaliseText(evidence.externalReference ?? evidence.sourceIdentifier);
}

function getStructuredClaims(evidence: VerificationEvidence): Record<string, unknown> | null {
  if (!isRecord(evidence.structuredData)) {
    return null;
  }
  const claims = evidence.structuredData.claims;
  return isRecord(claims) ? claims : evidence.structuredData;
}

function referenceValue(reference: EvidenceReference): string | null {
  if (typeof reference === 'string') {
    return normaliseText(reference);
  }
  if (!isRecord(reference)) {
    return null;
  }
  return normaliseText(
    reference.id ?? reference.evidenceId ?? reference.reference ?? reference.externalReference,
  );
}

function allEvidenceReferences(evidence: VerificationEvidence): readonly EvidenceReference[] {
  const references = [...(evidence.references ?? []), ...(evidence.evidenceReferences ?? [])];
  const structured = isRecord(evidence.structuredData)
    ? evidence.structuredData.references
    : undefined;
  if (Array.isArray(structured)) {
    references.push(
      ...structured.filter(
        (value): value is EvidenceReference => typeof value === 'string' || isRecord(value),
      ),
    );
  }
  return references;
}

function creditClaims(project: VerificationProject): readonly {
  readonly claim: CreditQuantityClaim;
  readonly path: string;
}[] {
  const claims: { claim: CreditQuantityClaim; path: string }[] = [];
  if (project.credit !== undefined && project.credit !== null) {
    claims.push({ claim: project.credit, path: 'project.credit' });
  } else if (project.creditQuantity !== undefined && project.creditQuantity !== null) {
    claims.push({ claim: { totalQuantity: project.creditQuantity }, path: 'project.credit' });
  }
  (project.creditBatches ?? []).forEach((claim: CreditBatchClaim, index) => {
    claims.push({ claim, path: `project.creditBatches[${index}]` });
  });
  return claims;
}

function creditEvents(claim: CreditQuantityClaim): readonly CreditEvent[] {
  return claim.events ?? [];
}

function numericFields(
  project: VerificationProject,
  evidence: readonly VerificationEvidence[],
): readonly {
  readonly path: string;
  readonly value: unknown;
  readonly evidenceId?: string;
}[] {
  const fields: { path: string; value: unknown; evidenceId?: string }[] = [];
  if (isPresent(project.quantity)) {
    fields.push({ path: 'project.quantity', value: project.quantity });
  }
  if (isPresent(project.creditQuantity)) {
    fields.push({ path: 'project.creditQuantity', value: project.creditQuantity });
  }
  for (const entry of creditClaims(project)) {
    for (const field of ['totalQuantity', 'issuedQuantity', 'retiredQuantity'] as const) {
      if (isPresent(entry.claim[field])) {
        fields.push({ path: `${entry.path}.${field}`, value: entry.claim[field] });
      }
    }
    creditEvents(entry.claim).forEach((event, index) => {
      if (isPresent(event.quantity)) {
        fields.push({ path: `${entry.path}.events[${index}].quantity`, value: event.quantity });
      }
    });
  }
  for (const item of evidence) {
    if (isPresent(item.quantity)) {
      fields.push({
        path: `evidence.${item.id}.quantity`,
        value: item.quantity,
        evidenceId: item.id,
      });
    }
    const structured = getStructuredClaims(item);
    if (structured !== null) {
      for (const field of ['quantity', 'creditQuantity', 'creditTotalQuantity'] as const) {
        if (isPresent(structured[field])) {
          fields.push({
            path: `evidence.${item.id}.structuredData.${field}`,
            value: structured[field],
            evidenceId: item.id,
          });
        }
      }
    }
  }
  return fields;
}

function comparableStructuredValue(field: string, value: unknown): string | number | null {
  if (field === 'unit') {
    return normaliseUnit(value);
  }
  if (field === 'quantity' || field === 'creditQuantity' || field === 'creditTotalQuantity') {
    return toFiniteNumber(value);
  }
  if (
    field === 'reportingPeriodStart' ||
    field === 'reportingPeriodEnd' ||
    field === 'reportingPeriod.start' ||
    field === 'reportingPeriod.end'
  ) {
    return parseDateValue(value);
  }
  return normaliseText(value);
}

function buildRules(): readonly VerificationRule[] {
  return [
    {
      id: 'required-evidence-missing',
      version: '1.0.0',
      defaultWeight: defaultWeight('required-evidence-missing'),
      evaluate: ({ project, evidence, config }) => {
        const findings: FindingDraft[] = [];
        for (const requirement of config.requiredEvidence) {
          const count = evidence.filter(
            (item) => normaliseText(item.evidenceType) === normaliseText(requirement.evidenceType),
          ).length;
          if (count < requirement.minimumCount) {
            findings.push(
              draft(
                'required-evidence-missing',
                FindingSeverity.HIGH,
                'completeness',
                'Required evidence is missing',
                `Project ${project.id} has ${count} ${requirement.evidenceType} evidence record(s), but ${requirement.minimumCount} are required.`,
                `${normaliseText(requirement.evidenceType) ?? requirement.evidenceType}:${requirement.minimumCount}`,
                [],
                ['evidence'],
                {
                  evidenceType: requirement.evidenceType,
                  observedCount: count,
                  requiredCount: requirement.minimumCount,
                },
                `At least ${requirement.minimumCount} evidence record(s) of type ${requirement.evidenceType} must be present.`,
                'Submit the missing evidence type before completing verification.',
              ),
            );
          }
        }
        return findings;
      },
    },
    {
      id: 'project-identifier-mismatch',
      version: '1.0.0',
      defaultWeight: defaultWeight('project-identifier-mismatch'),
      evaluate: ({ project, evidence }) =>
        evidence
          .filter((item) => evidenceIdentifierValues(project, item).length > 0)
          .map((item) =>
            draft(
              'project-identifier-mismatch',
              FindingSeverity.HIGH,
              'identity',
              'Evidence references a different project',
              `Evidence ${item.id} contains a project identifier that does not match project ${project.id}.`,
              item.id,
              [item.id],
              ['projectId', 'projectIdentifier', 'externalProjectId'],
              {
                projectId: item.projectId,
                projectIdentifier: item.projectIdentifier,
                externalProjectId: item.externalProjectId,
              },
              'Every supplied evidence project identifier must match the verified project identifier.',
              'Correct the project identifier or move the evidence to the project it actually describes.',
            ),
          ),
    },
    {
      id: 'reporting-period-inconsistency',
      version: '1.0.0',
      defaultWeight: defaultWeight('reporting-period-inconsistency'),
      evaluate: ({ project, evidence, config }) => {
        const projectPeriod = periodValues(project);
        const validEvidence = evidence
          .map((item) => ({ item, period: periodValues(item) }))
          .filter(
            (
              entry,
            ): entry is { item: VerificationEvidence; period: { start: number; end: number } } =>
              entry.period !== null,
          );
        const findings: FindingDraft[] = [];

        for (const entry of validEvidence) {
          const inconsistent =
            projectPeriod !== null &&
            (config.periodMatchMode === 'exact'
              ? entry.period.start !== projectPeriod.start || entry.period.end !== projectPeriod.end
              : entry.period.start < projectPeriod.start || entry.period.end > projectPeriod.end);
          if (inconsistent) {
            findings.push(
              draft(
                'reporting-period-inconsistency',
                FindingSeverity.HIGH,
                'temporal-consistency',
                'Evidence reporting period is inconsistent',
                `Evidence ${entry.item.id} does not match the project reporting period.`,
                `${entry.item.id}:project`,
                [entry.item.id],
                ['reportingPeriod'],
                { evidence: entry.period, project: projectPeriod },
                config.periodMatchMode === 'exact'
                  ? 'Evidence start and end boundaries must exactly match the project reporting period.'
                  : 'Evidence reporting boundaries must be contained within the project reporting period.',
                'Correct the reporting period or provide evidence for the project period.',
              ),
            );
          }
        }

        if (projectPeriod === null && validEvidence.length > 1) {
          const first = validEvidence[0];
          if (first !== undefined) {
            for (const entry of validEvidence.slice(1)) {
              if (
                entry.period.start !== first.period.start ||
                entry.period.end !== first.period.end
              ) {
                findings.push(
                  draft(
                    'reporting-period-inconsistency',
                    FindingSeverity.MEDIUM,
                    'temporal-consistency',
                    'Evidence reporting periods disagree',
                    `Evidence ${entry.item.id} reports a different period from the other period-bearing evidence.`,
                    `${entry.item.id}:evidence-set`,
                    [first.item.id, entry.item.id],
                    ['reportingPeriod'],
                    { first: first.period, conflicting: entry.period },
                    'All evidence with reporting periods must describe one consistent reporting period when the project period is not supplied.',
                    'Align the evidence reporting periods or provide the authoritative project reporting period.',
                  ),
                );
              }
            }
          }
        }
        return findings;
      },
    },
    {
      id: 'invalid-boundaries',
      version: '1.0.0',
      defaultWeight: defaultWeight('invalid-boundaries'),
      evaluate: ({ project, evidence }) => {
        const values: readonly {
          label: string;
          value: VerificationProject | VerificationEvidence;
          evidenceId?: string;
        }[] = [
          { label: 'project', value: project },
          ...evidence.map((item) => ({
            label: `evidence ${item.id}`,
            value: item,
            evidenceId: item.id,
          })),
        ];
        const findings: FindingDraft[] = [];
        for (const entry of values) {
          const period = getPeriod(entry.value);
          if (!period.present) {
            continue;
          }
          const start = parseDateValue(period.start);
          const end = parseDateValue(period.end);
          const invalid = start === null || end === null || start > end;
          if (invalid) {
            findings.push(
              draft(
                'invalid-boundaries',
                FindingSeverity.HIGH,
                'temporal-validity',
                'Reporting period boundaries are invalid',
                `${entry.label} has a missing, invalid, or reversed reporting period boundary.`,
                entry.label,
                entry.evidenceId === undefined ? [] : [entry.evidenceId],
                ['reportingPeriod.start', 'reportingPeriod.end'],
                { start: period.start, end: period.end },
                'Reporting period start and end must both be valid dates, with start no later than end.',
                'Fix both reporting period boundaries before relying on this record.',
              ),
            );
          }
        }
        return findings;
      },
    },
    {
      id: 'unit-mismatch',
      version: '1.0.0',
      defaultWeight: defaultWeight('unit-mismatch'),
      evaluate: ({ project, evidence }) => {
        const expected = normaliseUnit(project.unit);
        const unitBearing = evidence
          .map((item) => ({ item, unit: normaliseUnit(item.unit) }))
          .filter(
            (entry): entry is { item: VerificationEvidence; unit: string } => entry.unit !== null,
          );
        const findings: FindingDraft[] = [];
        if (expected !== null) {
          for (const entry of unitBearing) {
            if (entry.unit !== expected) {
              findings.push(
                draft(
                  'unit-mismatch',
                  FindingSeverity.HIGH,
                  'measurement-consistency',
                  'Evidence unit does not match the project unit',
                  `Evidence ${entry.item.id} uses ${entry.item.unit}, while project ${project.id} uses ${project.unit}.`,
                  `${entry.item.id}:project`,
                  [entry.item.id],
                  ['unit'],
                  { evidenceUnit: entry.item.unit, projectUnit: project.unit },
                  'Evidence units must match the project unit after standard unit spelling normalization.',
                  'Convert the quantity to the project unit or correct the unit metadata.',
                ),
              );
            }
          }
        } else if (unitBearing.length > 1) {
          const first = unitBearing[0];
          if (first !== undefined) {
            for (const entry of unitBearing.slice(1)) {
              if (entry.unit !== first.unit) {
                findings.push(
                  draft(
                    'unit-mismatch',
                    FindingSeverity.MEDIUM,
                    'measurement-consistency',
                    'Evidence units disagree',
                    `Evidence ${entry.item.id} uses a different unit from evidence ${first.item.id}.`,
                    `${entry.item.id}:evidence-set`,
                    [first.item.id, entry.item.id],
                    ['unit'],
                    { firstUnit: first.item.unit, conflictingUnit: entry.item.unit },
                    'Evidence records contributing to one project must use one consistent unit when no project unit is supplied.',
                    'Declare the project unit and normalize all evidence quantities to it.',
                  ),
                );
              }
            }
          }
        }
        return findings;
      },
    },
    {
      id: 'quantity-inconsistency',
      version: '1.0.0',
      defaultWeight: defaultWeight('quantity-inconsistency'),
      evaluate: ({ project, evidence, config }) => {
        const expected = toFiniteNumber(project.quantity);
        if (expected === null) {
          return [];
        }
        const quantities = evidence
          .map((item) => ({ item, quantity: toFiniteNumber(item.quantity) }))
          .filter(
            (entry): entry is { item: VerificationEvidence; quantity: number } =>
              entry.quantity !== null,
          );
        if (quantities.length === 0) {
          return [];
        }
        const observed = quantities.reduce((total, entry) => total + entry.quantity, 0);
        if (Math.abs(observed - expected) <= config.quantityTolerance) {
          return [];
        }
        return [
          draft(
            'quantity-inconsistency',
            FindingSeverity.HIGH,
            'measurement-consistency',
            'Evidence quantities do not reconcile',
            `Evidence quantities total ${observed}, while project quantity is ${expected}.`,
            'project-total',
            quantities.map((entry) => entry.item.id),
            ['quantity'],
            {
              observedTotal: observed,
              projectQuantity: expected,
              tolerance: config.quantityTolerance,
            },
            `The sum of evidence quantities must equal the project quantity within a tolerance of ${config.quantityTolerance}.`,
            'Reconcile source quantities, units, and the project total.',
          ),
        ];
      },
    },
    {
      id: 'duplicate-evidence-hash',
      version: '1.0.0',
      defaultWeight: defaultWeight('duplicate-evidence-hash'),
      evaluate: ({ evidence }) => {
        const groups = new Map<string, string[]>();
        for (const item of evidence) {
          const hash = evidenceHash(item);
          if (hash !== null) {
            groups.set(hash, [...(groups.get(hash) ?? []), item.id]);
          }
        }
        return [...groups.entries()]
          .filter(([, ids]) => ids.length > 1)
          .sort(([left], [right]) => compareText(left, right))
          .map(([hash, ids]) =>
            draft(
              'duplicate-evidence-hash',
              FindingSeverity.HIGH,
              'uniqueness',
              'Evidence hash is duplicated',
              `The evidence hash ${hash} is used by multiple evidence records.`,
              hash,
              ids,
              ['sha256'],
              { hash, evidenceIds: ids },
              'Each distinct evidence record must have a unique content hash.',
              'Remove duplicate uploads or correct the content hash metadata.',
            ),
          );
      },
    },
    {
      id: 'duplicate-external-reference',
      version: '1.0.0',
      defaultWeight: defaultWeight('duplicate-external-reference'),
      evaluate: ({ evidence }) => {
        const groups = new Map<string, string[]>();
        for (const item of evidence) {
          const reference = externalReference(item);
          if (reference !== null) {
            groups.set(reference, [...(groups.get(reference) ?? []), item.id]);
          }
        }
        return [...groups.entries()]
          .filter(([, ids]) => ids.length > 1)
          .sort(([left], [right]) => compareText(left, right))
          .map(([reference, ids]) =>
            draft(
              'duplicate-external-reference',
              FindingSeverity.HIGH,
              'uniqueness',
              'External evidence reference is duplicated',
              `The external reference ${reference} is used by multiple evidence records.`,
              reference,
              ids,
              ['externalReference', 'sourceIdentifier'],
              { reference, evidenceIds: ids },
              'An external source reference must identify one evidence record within the verified submission.',
              'Correct the reference or remove the duplicated evidence record.',
            ),
          );
      },
    },
    {
      id: 'malformed-structured-evidence',
      version: '1.0.0',
      defaultWeight: defaultWeight('malformed-structured-evidence'),
      evaluate: ({ evidence }) => {
        const findings: FindingDraft[] = [];
        for (const item of evidence) {
          if (!isPresent(item.structuredData)) {
            continue;
          }
          const structured = item.structuredData;
          const invalidClaims =
            isRecord(structured) && isPresent(structured.claims) && !isRecord(structured.claims);
          const invalidReferences =
            isRecord(structured) &&
            isPresent(structured.references) &&
            !Array.isArray(structured.references);
          if (!isRecord(structured) || invalidClaims || invalidReferences) {
            findings.push(
              draft(
                'malformed-structured-evidence',
                FindingSeverity.HIGH,
                'structure',
                'Structured evidence is malformed',
                `Evidence ${item.id} contains structured data that is not a valid object with valid claims and references shapes.`,
                item.id,
                [item.id],
                ['structuredData'],
                { structuredData: structured },
                'Structured evidence must be an object; claims must be an object and references must be an array when supplied.',
                'Repair the structured payload or submit a valid structured evidence document.',
              ),
            );
          }
        }
        return findings;
      },
    },
    {
      id: 'missing-provenance',
      version: '1.0.0',
      defaultWeight: defaultWeight('missing-provenance'),
      evaluate: ({ evidence }) =>
        evidence
          .filter((item) => {
            if (typeof item.provenance === 'string') {
              return item.provenance.trim().length === 0;
            }
            if (isRecord(item.provenance)) {
              return Object.values(item.provenance).every(
                (value) => !isPresent(value) || String(value).trim().length === 0,
              );
            }
            return (
              !isPresent(item.provenance) &&
              !isPresent(item.provenanceType) &&
              !isPresent(item.sourceUrl)
            );
          })
          .map((item) =>
            draft(
              'missing-provenance',
              FindingSeverity.MEDIUM,
              'provenance',
              'Evidence provenance is missing',
              `Evidence ${item.id} does not identify a provenance source or provenance type.`,
              item.id,
              [item.id],
              ['provenance'],
              {
                provenance: item.provenance,
                provenanceType: item.provenanceType,
                sourceUrl: item.sourceUrl,
              },
              'Every evidence record must identify its provenance source or provenance type.',
              'Add the originating source, registry reference, or provenance classification.',
            ),
          ),
    },
    {
      id: 'invalid-numeric-values',
      version: '1.0.0',
      defaultWeight: defaultWeight('invalid-numeric-values'),
      evaluate: ({ project, evidence }) =>
        numericFields(project, evidence)
          .filter((field) => {
            const parsed = toFiniteNumber(field.value);
            return parsed === null || parsed < 0;
          })
          .map((field) =>
            draft(
              'invalid-numeric-values',
              FindingSeverity.HIGH,
              'numeric-validity',
              'Numeric value is invalid',
              `${field.path} is not a finite, non-negative numeric value.`,
              field.path,
              field.evidenceId === undefined ? [] : [field.evidenceId],
              [field.path],
              { value: field.value },
              'Quantity values must be finite numbers greater than or equal to zero.',
              'Replace the value with a finite non-negative quantity in the declared unit.',
            ),
          ),
    },
    {
      id: 'repeated-evidence-references',
      version: '1.0.0',
      defaultWeight: defaultWeight('repeated-evidence-references'),
      evaluate: ({ evidence }) => {
        const groups = new Map<string, string[]>();
        for (const item of evidence) {
          for (const reference of allEvidenceReferences(item)) {
            const value = referenceValue(reference);
            if (value !== null) {
              groups.set(value, [...(groups.get(value) ?? []), item.id]);
            }
          }
        }
        return [...groups.entries()]
          .filter(([, ids]) => ids.length > 1)
          .sort(([left], [right]) => compareText(left, right))
          .map(([reference, ids]) =>
            draft(
              'repeated-evidence-references',
              FindingSeverity.MEDIUM,
              'references',
              'Evidence reference is repeated',
              `Evidence reference ${reference} appears more than once in the submitted evidence references.`,
              reference,
              ids,
              ['references'],
              { reference, evidenceIds: ids },
              'Each evidence reference should occur once in the submission.',
              'Remove repeated references and retain one canonical evidence reference.',
            ),
          );
      },
    },
    {
      id: 'contradictory-structured-claims',
      version: '1.0.0',
      defaultWeight: defaultWeight('contradictory-structured-claims'),
      evaluate: ({ evidence }) => {
        const findings: FindingDraft[] = [];
        for (const item of evidence) {
          const claims = getStructuredClaims(item);
          if (claims === null) {
            continue;
          }
          const fields: readonly {
            name: string;
            topLevel: unknown;
            claim: unknown;
            topField: string;
          }[] = [
            {
              name: 'project identifier',
              topLevel: item.projectId ?? item.projectIdentifier ?? item.externalProjectId,
              claim: claims.projectId ?? claims.projectIdentifier ?? claims.externalProjectId,
              topField: 'projectIdentifier',
            },
            { name: 'unit', topLevel: item.unit, claim: claims.unit, topField: 'unit' },
            {
              name: 'quantity',
              topLevel: item.quantity,
              claim: claims.quantity,
              topField: 'quantity',
            },
            {
              name: 'reporting period start',
              topLevel: getPeriod(item).start,
              claim:
                claims.reportingPeriodStart ??
                (isRecord(claims.reportingPeriod) ? claims.reportingPeriod.start : undefined),
              topField: 'reportingPeriod.start',
            },
            {
              name: 'reporting period end',
              topLevel: getPeriod(item).end,
              claim:
                claims.reportingPeriodEnd ??
                (isRecord(claims.reportingPeriod) ? claims.reportingPeriod.end : undefined),
              topField: 'reportingPeriod.end',
            },
          ];
          for (const field of fields) {
            if (!isPresent(field.topLevel) || !isPresent(field.claim)) {
              continue;
            }
            const top = comparableStructuredValue(field.topField, field.topLevel);
            const claim = comparableStructuredValue(field.topField, field.claim);
            if (top !== null && claim !== null && top !== claim) {
              findings.push(
                draft(
                  'contradictory-structured-claims',
                  FindingSeverity.HIGH,
                  'structure-consistency',
                  'Structured evidence contradicts its metadata',
                  `Evidence ${item.id} has conflicting ${field.name} values in its metadata and structured claims.`,
                  `${item.id}:${field.topField}`,
                  [item.id],
                  [field.topField, 'structuredData'],
                  { metadata: field.topLevel, structuredClaim: field.claim },
                  `The structured ${field.name} claim must agree with the corresponding evidence metadata.`,
                  'Correct either the structured claim or the evidence metadata so both state the same value.',
                ),
              );
            }
          }
        }
        return findings;
      },
    },
    {
      id: 'credit-quantity-inconsistency',
      version: '1.0.0',
      defaultWeight: defaultWeight('credit-quantity-inconsistency'),
      evaluate: ({ project }) => {
        const claims = creditClaims(project);
        if (claims.length === 0) {
          return [];
        }
        const findings: FindingDraft[] = [];
        const projectQuantity = toFiniteNumber(project.quantity);

        const batchClaims = claims.filter((entry) =>
          entry.path.startsWith('project.creditBatches['),
        );
        const reconciliationClaims = batchClaims.length > 0 ? batchClaims : claims;
        const totalValues = reconciliationClaims
          .map((entry) => toFiniteNumber(entry.claim.totalQuantity))
          .filter((value): value is number => value !== null);
        const aggregateTotal =
          totalValues.length === reconciliationClaims.length
            ? totalValues.reduce((sum, value) => sum + value, 0)
            : null;
        if (
          aggregateTotal !== null &&
          projectQuantity !== null &&
          Math.abs(aggregateTotal - projectQuantity) > 0
        ) {
          findings.push(
            draft(
              'credit-quantity-inconsistency',
              FindingSeverity.HIGH,
              'credit-accounting',
              'Credit quantity does not match project quantity',
              `Declared credit quantity ${aggregateTotal} does not match project quantity ${projectQuantity}.`,
              'total:project',
              [],
              ['credit.totalQuantity', 'quantity'],
              { creditTotal: aggregateTotal, projectQuantity },
              'The declared credit total must equal the project quantity.',
              'Reconcile the project quantity and credit batch total before issuance.',
            ),
          );
        }
        if (batchClaims.length > 0 && claims.length > batchClaims.length) {
          const summaryTotal = toFiniteNumber(claims[0]?.claim.totalQuantity);
          if (
            summaryTotal !== null &&
            aggregateTotal !== null &&
            Math.abs(summaryTotal - aggregateTotal) > 0
          ) {
            findings.push(
              draft(
                'credit-quantity-inconsistency',
                FindingSeverity.HIGH,
                'credit-accounting',
                'Credit summary and batches do not reconcile',
                `Credit batch totals ${aggregateTotal} do not match the declared credit summary ${summaryTotal}.`,
                'summary:batches',
                [],
                ['credit.totalQuantity', 'creditBatches.totalQuantity'],
                { summaryTotal, batchTotal: aggregateTotal },
                'The declared credit summary must equal the sum of its credit batch totals.',
                'Reconcile the credit summary and batch totals before recording issuance.',
              ),
            );
          }
        }
        for (const entry of claims) {
          const claim = entry.claim;
          const total = toFiniteNumber(claim.totalQuantity);
          const issued = toFiniteNumber(claim.issuedQuantity);
          const retired = toFiniteNumber(claim.retiredQuantity);
          if (total !== null && issued !== null && retired !== null && issued + retired > total) {
            findings.push(
              draft(
                'credit-quantity-inconsistency',
                FindingSeverity.CRITICAL,
                'credit-accounting',
                'Issued and retired credits exceed the total',
                `Issued plus retired credits (${issued + retired}) exceed the declared total (${total}).`,
                `${entry.path}:lifecycle-total`,
                [],
                [
                  `${entry.path}.issuedQuantity`,
                  `${entry.path}.retiredQuantity`,
                  `${entry.path}.totalQuantity`,
                ],
                { issued, retired, total },
                'Issued and retired quantities together must not exceed the total credit quantity.',
                'Correct the lifecycle quantities or the declared total before recording credit events.',
              ),
            );
          }
          const eventTotals = new Map<string, number>();
          for (const event of creditEvents(claim)) {
            const quantity = toFiniteNumber(event.quantity);
            const type = normaliseText(event.type ?? event.eventType);
            if (quantity !== null && type !== null) {
              eventTotals.set(type, (eventTotals.get(type) ?? 0) + quantity);
            }
          }
          const issuedEvents = eventTotals.get('issued') ?? 0;
          const retiredEvents = eventTotals.get('retired') ?? 0;
          if (issued !== null && eventTotals.has('issued') && issuedEvents !== issued) {
            findings.push(
              draft(
                'credit-quantity-inconsistency',
                FindingSeverity.HIGH,
                'credit-accounting',
                'Issued credit events do not reconcile',
                `Issued credit events total ${issuedEvents}, while the declared issued quantity is ${issued}.`,
                `${entry.path}:events:issued`,
                [],
                [`${entry.path}.issuedQuantity`, `${entry.path}.events`],
                { eventTotal: issuedEvents, declared: issued },
                'The sum of issued credit events must equal the declared issued quantity.',
                'Reconcile the issued events and declared issued quantity.',
              ),
            );
          }
          if (retired !== null && eventTotals.has('retired') && retiredEvents !== retired) {
            findings.push(
              draft(
                'credit-quantity-inconsistency',
                FindingSeverity.HIGH,
                'credit-accounting',
                'Retired credit events do not reconcile',
                `Retired credit events total ${retiredEvents}, while the declared retired quantity is ${retired}.`,
                `${entry.path}:events:retired`,
                [],
                [`${entry.path}.retiredQuantity`, `${entry.path}.events`],
                { eventTotal: retiredEvents, declared: retired },
                'The sum of retired credit events must equal the declared retired quantity.',
                'Reconcile the retired events and declared retired quantity.',
              ),
            );
          }
        }
        return findings;
      },
    },
  ];
}

export const DEFAULT_RULES: readonly VerificationRule[] = buildRules();

export class VerificationRuleRegistry implements VersionedRuleRegistry {
  public readonly version: string;
  public readonly rules: readonly VerificationRule[];

  public constructor(
    version = 'carbonproof-verification-rules@1.0.0',
    rules: readonly VerificationRule[] = DEFAULT_RULES,
  ) {
    this.version = version;
    this.rules = [...rules];
  }

  public getRule(id: string): VerificationRule | undefined {
    return this.rules.find((rule) => rule.id === id);
  }
}

export { VerificationRuleRegistry as RuleRegistry };

export function createDefaultRuleRegistry(version?: string): VerificationRuleRegistry {
  return new VerificationRuleRegistry(version);
}

export function resolveVerificationConfig(
  request: VerificationRequest,
  registry: VersionedRuleRegistry,
): ResolvedVerificationConfig {
  const input: VerificationConfig = request.config ?? {};
  const configuredRequirements = input.requiredEvidence ?? input.requiredEvidenceTypes;
  const projectRequirements =
    request.project.requiredEvidence ?? request.project.requiredEvidenceTypes;
  const requirementSource = configuredRequirements ?? projectRequirements ?? [];
  const requiredEvidence = requirementSource.map((requirement) => {
    if (typeof requirement === 'string') {
      return { evidenceType: requirement, minimumCount: 1 };
    }
    return { evidenceType: requirement.evidenceType, minimumCount: requirement.minimumCount ?? 1 };
  });
  const enabledRuleIds = new Set(
    (input.enabledRuleIds ?? registry.rules.map((rule) => rule.id)).filter(
      (id) => !(input.disabledRuleIds ?? []).includes(id),
    ),
  );
  const ruleWeights: Record<string, number> = {};
  for (const rule of registry.rules) {
    ruleWeights[rule.id] =
      input.ruleWeights?.[rule.id] ?? rule.defaultWeight ?? DEFAULT_WEIGHTS[rule.id] ?? 0;
  }
  const severityMultipliers = {
    ...DEFAULT_SEVERITY_MULTIPLIERS,
    ...(input.severityMultipliers ?? {}),
  };
  return {
    requiredEvidence,
    enabledRuleIds,
    ruleWeights,
    severityMultipliers,
    quantityTolerance: toFiniteNumber(input.quantityTolerance) ?? 0,
    periodMatchMode: input.periodMatchMode ?? 'exact',
  };
}

export function defaultRuleWeights(): Readonly<Record<string, number>> {
  return { ...DEFAULT_WEIGHTS };
}

export function ruleInputFingerprint(request: VerificationRequest): string {
  return stableSerialize(request);
}
