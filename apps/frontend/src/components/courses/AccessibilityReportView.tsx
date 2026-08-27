'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface AccessibilityReport {
  id: string;
  courseId: string;
  totalIssuesFound: number;
  activeIssuesCount: number;
  errorCount: number;
  warningCount: number;
  compliancePercentage: number;
  lastValidatedAt: string | null;
}

interface AccessibilityIssue {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  suggestedFix: string | null;
  isResolved: boolean;
}

export function AccessibilityReportView({ courseId }: { courseId: string }) {
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, [courseId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/v1/courses/${courseId}/accessibility/report`);
      setReport(response.data.report);

      const issuesResponse = await axios.get(`/v1/courses/${courseId}/accessibility/issues`);
      setIssues(issuesResponse.data.issues);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch accessibility report');
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    try {
      setLoading(true);
      await axios.post(`/v1/courses/${courseId}/accessibility/validate`, {});
      await fetchReport();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to run validation');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-amber-600 bg-amber-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Accessibility Report</h2>
            <Button onClick={runValidation} disabled={loading}>
              {loading ? 'Validating...' : 'Run Validation'}
            </Button>
          </div>

          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}

          {report && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm font-medium text-gray-600">Compliance Score</div>
                <div className="text-3xl font-bold text-green-600">{report.compliancePercentage}%</div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm font-medium text-gray-600">Total Issues</div>
                <div className="text-3xl font-bold">{report.totalIssuesFound}</div>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <div className="text-sm font-medium text-red-600">Errors</div>
                <div className="text-3xl font-bold text-red-600">{report.errorCount}</div>
              </div>
              <div className="bg-amber-50 p-4 rounded">
                <div className="text-sm font-medium text-amber-600">Warnings</div>
                <div className="text-3xl font-bold text-amber-600">{report.warningCount}</div>
              </div>
            </div>
          )}

          {report?.lastValidatedAt && (
            <div className="text-sm text-gray-500">
              Last validated: {new Date(report.lastValidatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </Card>

      {/* Issues List */}
      {issues.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-xl font-bold mb-4">Unresolved Issues ({issues.length})</h3>
            <div className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className={`p-4 rounded border ${getSeverityColor(issue.severity)}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold capitalize">{issue.type.replace(/_/g, ' ')}</div>
                      <div className="text-sm mt-1">{issue.description}</div>
                      {issue.suggestedFix && <div className="text-sm mt-2 italic">{issue.suggestedFix}</div>}
                    </div>
                    <span className="ml-4 px-3 py-1 rounded text-xs font-semibold capitalize">
                      {issue.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {issues.length === 0 && report && (
        <Card>
          <div className="p-6 text-center">
            <div className="text-green-600 text-lg font-semibold">✓ All accessibility checks passed!</div>
            <p className="text-gray-600 mt-2">Your course content meets accessibility standards.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
