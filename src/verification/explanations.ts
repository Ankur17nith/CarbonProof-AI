import type { FindingDraft } from './models.js';

export interface ExplanationProvider {
  explain(finding: FindingDraft): string;
}

/** A framework-free provider whose output is entirely derived from the finding. */
export class LocalExplanationProvider implements ExplanationProvider {
  public explain(finding: FindingDraft): string {
    return `${finding.title}: ${finding.message} Expected: ${finding.expectedCondition} Recommendation: ${finding.recommendation}`;
  }
}
