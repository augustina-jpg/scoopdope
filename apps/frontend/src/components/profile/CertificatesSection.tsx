'use client';

import Link from 'next/link';
import { Award, ExternalLink, Copy, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { useState } from 'react';
import { toast } from '@/lib/toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Certificate {
  id: string;
  courseId: string;
  certificateHash: string;
  stellarTransactionId: string | null;
  status: 'pending' | 'minted' | 'verified';
  issuedAt: string;
  revokedAt: string | null;
  course?: {
    id: string;
    title: string;
  };
}

interface CertificatesSectionProps {
  certificates: Certificate[];
  isLoading: boolean;
  error: Error | null;
}

// ── Stellar Explorer URL helper ───────────────────────────────────────────────

function stellarExplorerUrl(txHash: string): string {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  minted: {
    label: 'Minted',
    icon: CheckCircle,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  verified: {
    label: 'Verified',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
} as const;

function StatusBadge({ status }: { status: Certificate['status'] }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

// ── Single certificate card ───────────────────────────────────────────────────

function CertificateCard({ cert }: { cert: Certificate }) {
  const [copied, setCopied] = useState(false);

  const siteUrl =
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://scoopdope.app';
  const shareUrl = `${siteUrl}/certificates/${cert.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Certificate link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const issuedDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(cert.issuedAt),
  );

  const courseTitle = cert.course?.title ?? 'Course';

  return (
    <article
      className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
      aria-label={`Certificate for ${courseTitle}`}
    >
      {/* Icon + title row */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={courseTitle}>
            {courseTitle}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Issued {issuedDate}</p>
        </div>
        <StatusBadge status={cert.status} />
      </div>

      {/* Transaction hash */}
      {cert.stellarTransactionId && (
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate" title={cert.stellarTransactionId}>
          Tx: {cert.stellarTransactionId}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-1">
        {/* View certificate */}
        <Link
          href={`/certificates/${cert.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`View certificate for ${courseTitle} in new tab`}
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          View
        </Link>

        {/* Stellar explorer */}
        {cert.stellarTransactionId && (
          <a
            href={stellarExplorerUrl(cert.stellarTransactionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`Verify ${courseTitle} certificate on Stellar explorer`}
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            Verify on Stellar
          </a>
        )}

        {/* Copy share link */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`Copy share link for ${courseTitle} certificate`}
        >
          {copied ? (
            <CheckCircle className="w-3 h-3 text-green-500" aria-hidden="true" />
          ) : (
            <Copy className="w-3 h-3" aria-hidden="true" />
          )}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>
    </article>
  );
}

// ── Skeleton for a single card ────────────────────────────────────────────────

function CertificateCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton variant="rectangular" width={36} height={36} className="rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="70%" />
          <Skeleton height={12} width="40%" />
        </div>
        <Skeleton height={20} width={64} variant="rectangular" className="rounded-full" />
      </div>
      <Skeleton height={12} width="90%" />
      <div className="flex gap-2">
        <Skeleton height={30} width={60} variant="rectangular" className="rounded-lg" />
        <Skeleton height={30} width={120} variant="rectangular" className="rounded-lg" />
        <Skeleton height={30} width={72} variant="rectangular" className="rounded-lg" />
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function CertificatesSection({ certificates, isLoading, error }: CertificatesSectionProps) {
  return (
    <section className="space-y-4" aria-labelledby="certificates-heading">
      <h2 id="certificates-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
        Certificates
      </h2>

      {/* Loading state */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading certificates"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {Array.from({ length: 2 }).map((_, i) => (
            <CertificateCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300"
        >
          Failed to load certificates. Please try refreshing the page.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && certificates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center gap-3">
          <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800">
            <Award className="w-6 h-6 text-gray-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              No certificates yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Complete a course to earn your first certificate.
            </p>
          </div>
          <Link
            href="/courses"
            className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Browse courses →
          </Link>
        </div>
      )}

      {/* Certificate grid */}
      {!isLoading && !error && certificates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {certificates.map((cert) => (
            <CertificateCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </section>
  );
}
