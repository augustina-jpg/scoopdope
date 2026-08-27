import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  isApiVersion,
  DEFAULT_API_VERSION,
  API_VERSION_HEADER,
} from './api-version.constants';

declare global {
  namespace Express {
    interface Request {
      metadata?: { version: string };
    }
  }
}

@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  /**
   * Parse Accept header to extract version parameter.
   * Supports: Accept: application/json; version=1
   */
  private parseAcceptHeaderVersion(acceptHeader: string): string | null {
    try {
      const versionMatch = acceptHeader.match(/;\s*version\s*=\s*(\d+)/i);
      if (versionMatch && versionMatch[1]) {
        const versionNum = parseInt(versionMatch[1], 10);
        const versionStr = `v${versionNum}`;
        if (isApiVersion(versionStr)) {
          return versionStr;
        }
      }
    } catch (e) {
      // Silently fail on malformed header
    }
    return null;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const pathParts = req.path.split('/').filter(Boolean);

    let version: string | null = null;
    let requestedVersionFromHeader: string | null = null;

    // Priority 1: URL path prefix (highest priority)
    if (pathParts.length > 0 && /^v\d+$/.test(pathParts[0])) {
      version = pathParts[0];
    }

    // Priority 2: Query parameter ?version=1
    if (!version && req.query.version) {
      const queryVersion = req.query.version as string;
      if (/^\d+$/.test(queryVersion)) {
        const versionStr = `v${queryVersion}`;
        if (isApiVersion(versionStr)) {
          version = versionStr;
        } else {
          // Invalid version in query param
          throw new BadRequestException(
            `Invalid API version "${versionStr}". Supported versions: ${this.getSupportedVersions()}`
          );
        }
      }
    }

    // Priority 3: Accept header with version parameter (e.g., Accept: application/json; version=1)
    if (!version) {
      const acceptHeader = req.headers.accept as string | undefined;
      if (acceptHeader) {
        const acceptVersionStr = this.parseAcceptHeaderVersion(acceptHeader);
        if (acceptVersionStr) {
          version = acceptVersionStr;
          requestedVersionFromHeader = acceptVersionStr;
        }
      }
    }

    // Priority 4: Accept-Version header
    if (!version) {
      const headerVersion = req.headers[API_VERSION_HEADER.toLowerCase()] as string | undefined;
      if (headerVersion) {
        if (isApiVersion(headerVersion)) {
          version = headerVersion;
          requestedVersionFromHeader = headerVersion;
        } else {
          // Invalid version in header
          throw new BadRequestException(
            `Invalid API version "${headerVersion}". Supported versions: ${this.getSupportedVersions()}`
          );
        }
      }
    }

    // Fallback: Default version
    if (!version) {
      version = DEFAULT_API_VERSION;
    }

    req.metadata = {
      ...req.metadata,
      version,
      requestedVersionFromHeader,
    };

    next();
  }

  private getSupportedVersions(): string {
    return ['v1'].join(', '); // TODO: Update when new versions are added
  }
}
