import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CertificatesSection, type Certificate } from '@/components/profile/CertificatesSection';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const mintedCert: Certificate = {
  id: 'cert-1',
  courseId: 'course-1',
  certificateHash: 'abc123def456',
  stellarTransactionId: 'tx-hash-abc123',
  status: 'minted',
  issuedAt: '2026-03-15T10:00:00.000Z',
  revokedAt: null,
  course: { id: 'course-1', title: 'Intro to Stellar Blockchain' },
};

const pendingCert: Certificate = {
  id: 'cert-2',
  courseId: 'course-2',
  certificateHash: 'def789ghi000',
  stellarTransactionId: null,
  status: 'pending',
  issuedAt: '2026-04-01T08:00:00.000Z',
  revokedAt: null,
  course: { id: 'course-2', title: 'Soroban Smart Contracts' },
};

const verifiedCert: Certificate = {
  id: 'cert-3',
  courseId: 'course-3',
  certificateHash: 'ghi111jkl222',
  stellarTransactionId: 'tx-verified-xyz',
  status: 'verified',
  issuedAt: '2026-01-20T12:00:00.000Z',
  revokedAt: null,
  course: { id: 'course-3', title: 'DeFi on Stellar' },
};

// ── CertificatesSection ───────────────────────────────────────────────────────

describe('CertificatesSection', () => {
  // ── Loading state ───────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders skeleton placeholders while loading', () => {
      render(
        <CertificatesSection
          certificates={[]}
          isLoading={true}
          error={null}
        />
      );

      // The loading container should have role="status"
      expect(screen.getByRole('status', { name: /loading certificates/i })).toBeInTheDocument();
    });

    it('does not render certificate cards while loading', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={true}
          error={null}
        />
      );

      // Title from the mocked certificate should not be visible yet
      expect(screen.queryByText('Intro to Stellar Blockchain')).not.toBeInTheDocument();
    });
  });

  // ── Error state ─────────────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error message when error is provided', () => {
      render(
        <CertificatesSection
          certificates={[]}
          isLoading={false}
          error={new Error('Network error')}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load certificates/i)).toBeInTheDocument();
    });

    it('does not show error when there is no error', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state message when no certificates', () => {
      render(
        <CertificatesSection
          certificates={[]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText(/no certificates yet/i)).toBeInTheDocument();
    });

    it('renders a Browse courses link in empty state', () => {
      render(
        <CertificatesSection
          certificates={[]}
          isLoading={false}
          error={null}
        />
      );

      const browseLink = screen.getByRole('link', { name: /browse courses/i });
      expect(browseLink).toBeInTheDocument();
      expect(browseLink).toHaveAttribute('href', '/courses');
    });
  });

  // ── Certificate cards ───────────────────────────────────────────────────────

  describe('certificate cards', () => {
    it('renders a card for each certificate', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert, pendingCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText('Intro to Stellar Blockchain')).toBeInTheDocument();
      expect(screen.getByText('Soroban Smart Contracts')).toBeInTheDocument();
    });

    it('shows the course title on each card', () => {
      render(
        <CertificatesSection
          certificates={[verifiedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText('DeFi on Stellar')).toBeInTheDocument();
    });

    it('shows the correct status badge — Minted', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText('Minted')).toBeInTheDocument();
    });

    it('shows the correct status badge — Pending', () => {
      render(
        <CertificatesSection
          certificates={[pendingCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('shows the correct status badge — Verified', () => {
      render(
        <CertificatesSection
          certificates={[verifiedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders the Stellar explorer link when a transaction ID is present', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      const stellarLink = screen.getByRole('link', {
        name: /verify.*stellar/i,
      });
      expect(stellarLink).toBeInTheDocument();
      expect(stellarLink).toHaveAttribute('href', expect.stringContaining('tx-hash-abc123'));
      expect(stellarLink).toHaveAttribute('target', '_blank');
      expect(stellarLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('does NOT render the Stellar explorer link when no transaction ID', () => {
      render(
        <CertificatesSection
          certificates={[pendingCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.queryByRole('link', { name: /verify.*stellar/i })).not.toBeInTheDocument();
    });

    it('renders a View link that opens in a new tab', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      const viewLink = screen.getByRole('link', { name: /view certificate for intro to stellar/i });
      expect(viewLink).toHaveAttribute('href', `/certificates/${mintedCert.id}`);
      expect(viewLink).toHaveAttribute('target', '_blank');
    });

    it('renders a Share button on each card', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(
        screen.getByRole('button', { name: /copy share link for intro to stellar/i })
      ).toBeInTheDocument();
    });

    it('shows the transaction hash truncated on the card', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByText(/tx-hash-abc123/i)).toBeInTheDocument();
    });
  });

  // ── Accessibility ───────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('the section has an accessible heading', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(screen.getByRole('heading', { name: /certificates/i })).toBeInTheDocument();
    });

    it('each certificate card has an aria-label identifying the course', () => {
      render(
        <CertificatesSection
          certificates={[mintedCert]}
          isLoading={false}
          error={null}
        />
      );

      expect(
        screen.getByRole('article', { name: /certificate for intro to stellar/i })
      ).toBeInTheDocument();
    });
  });
});
