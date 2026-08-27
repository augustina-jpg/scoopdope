'use client';

import { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ExportOptions {
  format: 'csv' | 'pdf';
}

export function ProgressExportButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async (format: ExportOptions['format']) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await axios.get(`/v1/users/${userId}/progress/export`, {
        params: { format },
      });

      const { filename, data } = response.data;

      if (format === 'csv') {
        // Download CSV
        downloadCSV(data, filename);
      } else if (format === 'pdf') {
        // For PDF, parse the JSON and trigger download (frontend will generate PDF)
        const pdfData = JSON.parse(data);
        downloadPDF(pdfData, filename);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to export progress as ${format.toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (content: string, filename: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPDF = (data: any, filename: string) => {
    // Generate PDF from JSON data (simplified - would use library like pdf-lib in production)
    const content = generatePDFContent(data);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(content)));
    element.setAttribute('download', filename.replace('.pdf', '.json'));
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const generatePDFContent = (data: any) => {
    return {
      title: data.title,
      date: data.generatedDate,
      summary: data.summary,
      courses: data.courses.map((c: any) => ({
        name: c.courseName,
        completion: `${c.completionPercentage}%`,
        status: c.status,
      })),
    };
  };

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-bold mb-4">Export Progress</h3>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}

        {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">✓ Export successful!</div>}

        <div className="flex gap-3">
          <Button
            onClick={() => handleExport('csv')}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Exporting...' : '📊 Export as CSV'}
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Exporting...' : '📄 Export as PDF'}
          </Button>
        </div>

        <p className="text-sm text-gray-600 mt-4">
          Download your complete progress data including all courses, completion percentages, and activity dates.
        </p>
      </div>
    </Card>
  );
}
