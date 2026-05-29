'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function PrivacySettings() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setStatus(null);
    try {
      const response = await api.get('/users/me/export');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scoopdope-personal-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Your data has been downloaded.' });
    } catch {
      setStatus({
        type: 'error',
        message: 'Failed to export data. Please try again later.',
      });
    } finally {
      setExporting(false);
    }
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    setStatus(null);
    try {
      await api.delete('/users/me');
      setStatus({ type: 'success', message: 'Account deleted. Redirecting...' });
      setTimeout(() => {
        localStorage.clear();
        window.location.href = '/';
      }, 2000);
    } catch {
      setStatus({
        type: 'error',
        message: 'Failed to delete account. Please try again later.',
      });
      setDeleting(false);
    }
  }, [confirmText]);

  const openConfirm = useCallback(() => {
    setConfirmText('');
    setStatus(null);
    setShowConfirm(true);
  }, []);

  return (
    <div className="space-y-6 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
        Privacy & GDPR
      </h3>

      {/* Status messages */}
      {status && (
        <div
          role="alert"
          className={`p-3 rounded-lg text-sm ${
            status.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {status.message}
        </div>
      )}

      {/* Data Export */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          Download Your Data
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Export all your personal data in a machine-readable JSON format.
          Includes your profile, enrollments, progress, certificates, forum
          posts, reviews, and more. (GDPR Art. 20)
        </p>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? 'Preparing export...' : 'Download my data'}
        </Button>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Account Deletion */}
      <div className="space-y-3">
        <h4 className="font-semibold text-red-600 dark:text-red-400">
          Delete Account
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Permanently delete your account and anonymize all personal data.
          Your forum posts, reviews, and Q&A contributions will remain but
          will no longer be attributed to you. This action cannot be undone.
          (GDPR Art. 17)
        </p>
        <Button variant="outline" onClick={openConfirm}>
          Delete my account
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Delete Account"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            This action is permanent and cannot be undone. All your personal
            data will be anonymized. You will lose access to your courses,
            certificates, and progress.
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Type{' '}
            <span className="font-mono font-bold text-red-600 dark:text-red-400">
              DELETE
            </span>{' '}
            to confirm:
          </p>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            aria-label="Type DELETE to confirm account deletion"
          />

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <button
              onClick={handleDeleteConfirm}
              disabled={confirmText !== 'DELETE' || deleting}
              className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Permanently delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
