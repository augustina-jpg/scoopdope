export class ProgressExportQueryDto {
  /** Export format: 'csv' or 'pdf' */
  format: 'csv' | 'pdf' = 'csv';

  /** Optional: user ID to export for (for instructors exporting student progress) */
  userId?: string;
}

export class ProgressExportResponseDto {
  success: boolean;
  message: string;
  filename: string;
  format: 'csv' | 'pdf';
  data?: any; // CSV content or PDF data URL
}
