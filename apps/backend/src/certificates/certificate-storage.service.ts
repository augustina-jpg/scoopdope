import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Minimal object-storage abstraction for generated certificate PDFs.
 *
 * Files are written to a local (or mounted) bucket directory and exposed via a
 * public base URL. The returned URL is persisted on the certificate row
 * (`pdfUrl`) so subsequent requests reuse the same object instead of
 * regenerating it — satisfying the "calling the endpoint twice returns the
 * same file (cached)" acceptance criterion.
 */
@Injectable()
export class CertificateStorageService {
  private readonly logger = new Logger(CertificateStorageService.name);
  private readonly bucketDir: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketDir =
      this.configService.get<string>('CERTIFICATE_STORAGE_DIR') ??
      path.join(process.cwd(), 'storage', 'certificates');
    this.publicBaseUrl =
      this.configService.get<string>('CERTIFICATE_STORAGE_BASE_URL') ??
      '/storage/certificates';
  }

  /**
   * Persists a PDF buffer and returns its public URL. The object key is
   * derived from the certificate id + content hash so identical content maps
   * to the same stored object (idempotent / cached).
   */
  async storeCertificatePdf(certificateId: string, pdf: Buffer): Promise<string> {
    const contentHash = crypto.createHash('sha256').update(pdf).digest('hex').slice(0, 16);
    const fileName = `certificate-${certificateId}-${contentHash}.pdf`;
    const filePath = path.join(this.bucketDir, fileName);

    try {
      await fs.mkdir(this.bucketDir, { recursive: true });
      // Write only if absent — keeps the stored object stable across calls.
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, pdf);
      }
    } catch (err) {
      this.logger.error(
        `Failed to persist certificate PDF ${fileName}: ${(err as Error).message}`,
      );
      throw err;
    }

    return `${this.publicBaseUrl.replace(/\/$/, '')}/${fileName}`;
  }

  /**
   * Reads a previously stored PDF back from the bucket by its public URL.
   * Returns null when the object is missing (e.g. bucket was cleared).
   */
  async readCertificatePdf(publicUrl: string): Promise<Buffer | null> {
    const fileName = publicUrl.split('/').pop();
    if (!fileName) return null;
    try {
      return await fs.readFile(path.join(this.bucketDir, fileName));
    } catch {
      return null;
    }
  }
}