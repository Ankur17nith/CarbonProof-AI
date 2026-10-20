import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(
    process.env.DEV_BOOTSTRAP_PASSWORD ?? 'development-only-password-123',
    12,
  );
  const contributor = await prisma.user.upsert({
    where: { email: 'contributor@example.test' },
    update: {
      displayName: 'Demo Contributor',
      passwordHash,
      role: 'CONTRIBUTOR',
      status: 'ACTIVE',
    },
    create: {
      id: 'seed-contributor',
      email: 'contributor@example.test',
      displayName: 'Demo Contributor',
      passwordHash,
      role: 'CONTRIBUTOR',
      status: 'ACTIVE',
    },
  });
  await prisma.user.upsert({
    where: { email: 'reviewer@example.test' },
    update: { displayName: 'Demo Reviewer', passwordHash, role: 'REVIEWER', status: 'ACTIVE' },
    create: {
      id: 'seed-reviewer',
      email: 'reviewer@example.test',
      displayName: 'Demo Reviewer',
      passwordHash,
      role: 'REVIEWER',
      status: 'ACTIVE',
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin@example.test' },
    update: { displayName: 'Demo Administrator', passwordHash, role: 'ADMIN', status: 'ACTIVE' },
    create: {
      id: 'seed-admin',
      email: 'admin@example.test',
      displayName: 'Demo Administrator',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const project = await prisma.project.upsert({
    where: { slug: 'synthetic-forest-demo' },
    update: {
      name: 'Synthetic Forest Demo',
      isSynthetic: true,
      dataOrigin: 'SYNTHETIC_DEMO',
      createdById: contributor.id,
    },
    create: {
      id: 'seed-project',
      name: 'Synthetic Forest Demo',
      slug: 'synthetic-forest-demo',
      projectType: 'REFORESTATION',
      methodology: 'Demo Methodology',
      dataOrigin: 'SYNTHETIC_DEMO',
      isSynthetic: true,
      createdById: contributor.id,
    },
  });

  await prisma.evidence.upsert({
    where: { id: 'seed-evidence' },
    update: {
      projectId: project.id,
      title: 'Synthetic satellite evidence',
      sha256: 'seed-synthetic-evidence-hash',
      isPublic: true,
      submittedById: contributor.id,
    },
    create: {
      id: 'seed-evidence',
      projectId: project.id,
      evidenceType: 'satellite',
      title: 'Synthetic satellite evidence',
      mediaType: 'application/json',
      fileSize: 2n,
      storageKey: 'seed/synthetic-evidence.json',
      sha256: 'seed-synthetic-evidence-hash',
      structuredData: { claims: { quantity: 10 }, synthetic: true } satisfies Prisma.InputJsonValue,
      submittedById: contributor.id,
      provenanceType: 'SYNTHETIC',
      isPublic: true,
    },
  });

  await prisma.creditBatch.upsert({
    where: { projectId_batchReference: { projectId: project.id, batchReference: 'DEMO-001' } },
    update: { totalQuantity: 100n, isSynthetic: true },
    create: {
      id: 'seed-credit-batch',
      projectId: project.id,
      batchReference: 'DEMO-001',
      unit: 'tCO2e',
      totalQuantity: 100n,
      isSynthetic: true,
    },
  });
  console.log(`Seeded synthetic project ${project.id}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
