import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  Coins,
  ExternalLink,
  Info,
} from 'lucide-react';

export function PublicVerificationPage() {
  const [lookupType, setLookupType] = useState<'project' | 'evidence' | 'credit'>('project');
  const [lookupId, setLookupId] = useState('');
  const [activeQuery, setActiveQuery] = useState<{ type: string; id: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-lookup', activeQuery?.type, activeQuery?.id],
    queryFn: async () => {
      if (!activeQuery?.id) return null;
      if (activeQuery.type === 'project') {
        return api.get<Record<string, unknown>>(`public/projects/${activeQuery.id}`);
      }
      if (activeQuery.type === 'evidence') {
        return api.get<Record<string, unknown>>(`public/evidence/${activeQuery.id}/verify`);
      }
      if (activeQuery.type === 'credit') {
        return api.get<Record<string, unknown>>(`public/credits/${activeQuery.id}`);
      }
      return null;
    },
    enabled: Boolean(activeQuery?.id),
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    setActiveQuery({ type: lookupType, id: lookupId.trim() });
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/80 pb-5 space-y-1 text-center sm:text-left">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <ShieldCheck className="h-6 w-6 text-accent" />
          <h2 className="text-xl font-bold tracking-tight text-fg">Public Verification Portal</h2>
        </div>
        <p className="text-xs text-fg-secondary">
          Zero-trust public lookup for project disclosures, cryptographic evidence integrity, and credit settlement records.
        </p>
      </div>

      {/* Lookup Card Form */}
      <Card className="p-5 border-border shadow-card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setLookupType('project');
                setActiveQuery(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors focus-ring ${
                lookupType === 'project'
                  ? 'bg-accent text-white font-semibold'
                  : 'bg-surface-secondary text-fg-secondary hover:text-fg'
              }`}
            >
              Verify Project
            </button>
            <button
              type="button"
              onClick={() => {
                setLookupType('evidence');
                setActiveQuery(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors focus-ring ${
                lookupType === 'evidence'
                  ? 'bg-accent text-white font-semibold'
                  : 'bg-surface-secondary text-fg-secondary hover:text-fg'
              }`}
            >
              Verify Evidence Fingerprint
            </button>
            <button
              type="button"
              onClick={() => {
                setLookupType('credit');
                setActiveQuery(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors focus-ring ${
                lookupType === 'credit'
                  ? 'bg-accent text-white font-semibold'
                  : 'bg-surface-secondary text-fg-secondary hover:text-fg'
              }`}
            >
              Verify Credit Settlement
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              placeholder={
                lookupType === 'project'
                  ? 'Enter project UUID (e.g. seed-project)'
                  : lookupType === 'evidence'
                    ? 'Enter evidence UUID (e.g. seed-evidence)'
                    : 'Enter credit record ID or batch ID'
              }
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="md" className="whitespace-nowrap">
              <Search className="h-4 w-4" />
              <span>Verify Record</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Honest Disclosure Callout */}
      <div className="rounded-lg border border-border bg-surface-secondary/40 p-4 space-y-1 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-fg">
          <Info className="h-4 w-4 text-accent" />
          <span>Cryptographic Proof Guarantee & Scope</span>
        </div>
        <p className="text-fg-secondary leading-relaxed">
          Matching evidence hashes certify strictly that the retrieved document payload is byte-for-byte identical to the fingerprint recorded at time of submission. It does not certify that the claims within the document are true without independent sensor audit.
        </p>
      </div>

      {/* Result Display */}
      {isLoading && (
        <Card className="p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </Card>
      )}

      {isError && (
        <Card className="p-8 text-center space-y-2 border-status-error-border bg-status-error-bg/30">
          <AlertTriangle className="h-6 w-6 text-status-error-text mx-auto" />
          <h4 className="text-sm font-semibold text-status-error-text">Record Not Disclosed</h4>
          <p className="text-xs text-fg-secondary max-w-sm mx-auto">
            {error instanceof Error ? error.message : 'No public record exists with the provided identifier.'}
          </p>
        </Card>
      )}

      {data && !isLoading && (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-success-text" />
                <CardTitle className="text-sm font-semibold">Verified Public Disclosure</CardTitle>
              </div>
              <CardDescription>
                Publicly verifiable record confirmed by backend ledger.
              </CardDescription>
            </div>
            <Badge variant="success">Disclosed</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border bg-surface-secondary/50 p-4 font-mono text-xs overflow-x-auto">
              <pre className="text-fg whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
