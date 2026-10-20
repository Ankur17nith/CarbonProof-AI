import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

async function login(app: Parameters<typeof request>[0], email: string) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'development-only-password-123' });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

describe('CarbonProof AI API', () => {
  it('rejects protected requests without authentication', async () => {
    const context = await createApp({
      NODE_ENV: 'test',
      FILE_STORAGE_ROOT: '/tmp/carbonproof-api-test-auth',
    });
    const response = await request(context.app).get('/api/v1/projects');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('runs the synthetic project, evidence, assessment, review, and credit lifecycle', async () => {
    const context = await createApp({
      NODE_ENV: 'test',
      FILE_STORAGE_ROOT: '/tmp/carbonproof-api-test-flow',
    });
    const contributor = await login(context.app, 'contributor@example.test');
    const reviewer = await login(context.app, 'reviewer@example.test');
    const admin = await login(context.app, 'admin@example.test');

    const projectResponse = await request(context.app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        name: 'Synthetic Forest Demo',
        slug: 'synthetic-forest-demo',
        projectType: 'REFORESTATION',
        methodology: 'Demo Methodology',
        dataOrigin: 'SYNTHETIC_DEMO',
        isSynthetic: true,
      });
    expect(projectResponse.status).toBe(201);
    const projectId = projectResponse.body.data.id as string;

    const evidenceResponse = await request(context.app)
      .post(`/api/v1/projects/${projectId}/evidence`)
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        evidenceType: 'satellite',
        title: 'Synthetic satellite evidence',
        mediaType: 'application/json',
        structuredData: { claims: { quantity: 10 } },
        isPublic: true,
      });
    expect(evidenceResponse.status).toBe(201);
    expect(evidenceResponse.body.data.sha256).toMatch(/^[a-f0-9]{64}$/);
    const evidenceId = evidenceResponse.body.data.id as string;

    const integrityResponse = await request(context.app)
      .post(`/api/v1/evidence/${evidenceId}/verify-integrity`)
      .set('Authorization', `Bearer ${contributor}`);
    expect(integrityResponse.status).toBe(200);
    expect(integrityResponse.body.data.status).toBe('MATCH');

    const assessmentResponse = await request(context.app)
      .post(`/api/v1/projects/${projectId}/assessments`)
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        evidenceIds: [evidenceId],
        verification: { config: { requiredEvidenceTypes: ['registry_document'] } },
      });
    expect(assessmentResponse.status).toBe(201);
    expect(assessmentResponse.body.data.assessment.assessmentStatus).toBe(
      'COMPLETED_WITH_FINDINGS',
    );
    expect(assessmentResponse.body.data.findings.length).toBeGreaterThan(0);
    const assessmentId = assessmentResponse.body.data.assessment.id as string;

    const reviewResponse = await request(context.app)
      .post(`/api/v1/assessments/${assessmentId}/reviews`)
      .set('Authorization', `Bearer ${reviewer}`)
      .send({
        decision: 'NEEDS_MORE_EVIDENCE',
        rationale: 'The synthetic demonstration needs additional source evidence.',
      });
    expect(reviewResponse.status).toBe(201);

    const batchResponse = await request(context.app)
      .post('/api/v1/credits/batches')
      .set('Authorization', `Bearer ${contributor}`)
      .send({
        projectId,
        batchReference: 'DEMO-001',
        unit: 'tCO2e',
        totalQuantity: '100',
        isSynthetic: true,
      });
    expect(batchResponse.status).toBe(201);
    const batchId = batchResponse.body.data.id as string;

    const issueResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'issue-demo-1')
      .send({ quantity: '60' });
    expect(issueResponse.status).toBe(201);
    expect(issueResponse.body.data.batch.issuedQuantity).toBe('60');

    const replayResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'issue-demo-1')
      .send({ quantity: '60' });
    expect(replayResponse.status).toBe(201);
    expect(replayResponse.body.data.replayed).toBe(true);

    const retireResponse = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/retire`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'retire-demo-1')
      .send({ quantity: '25' });
    expect(retireResponse.status).toBe(201);
    expect(retireResponse.body.data.batch.retiredQuantity).toBe('25');

    const excessiveRetirement = await request(context.app)
      .post(`/api/v1/credits/batches/${batchId}/retire`)
      .set('Authorization', `Bearer ${admin}`)
      .set('Idempotency-Key', 'retire-demo-2')
      .send({ quantity: '40' });
    expect(excessiveRetirement.status).toBe(409);
    expect(excessiveRetirement.body.error.code).toBe('INSUFFICIENT_AVAILABLE_CREDITS');

    const publicResponse = await request(context.app).get(`/api/v1/public/credits/${batchId}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.availableQuantity).toBe('35');
    expect(publicResponse.body.data.isSynthetic).toBe(true);
  });
});
