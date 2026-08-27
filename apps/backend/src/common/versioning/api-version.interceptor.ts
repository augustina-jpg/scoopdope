import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiVersion,
  X_API_VERSION,
  X_API_DEPRECATED,
  X_API_SUNSET,
  VERSION_MANIFEST,
  DEFAULT_API_VERSION,
  getVersionInfo,
  API_VERSION_HEADER,
} from './api-version.constants';

export const RESOLVED_VERSION_KEY = 'api:resolvedVersion';

@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();

    const version: ApiVersion =
      request.metadata?.version ??
      this.reflector.get<ApiVersion>(RESOLVED_VERSION_KEY, context.getHandler()) ??
      DEFAULT_API_VERSION;

    // Always set the current API version being used
    response.setHeader(X_API_VERSION, version);

    const info = getVersionInfo(version);

    // If the version is deprecated, set deprecation headers
    if (info.deprecationDate && info.deprecationDate <= new Date()) {
      response.setHeader(
        X_API_DEPRECATED,
        `true; deprecation_date=${info.deprecationDate.toISOString()}`
      );

      if (info.sunsetDate) {
        response.setHeader(X_API_SUNSET, info.sunsetDate.toISOString());
      }
    }

    // If client requested a different version (from header or Accept param), warn them
    const requestedVersionFromHeader = request.metadata?.requestedVersionFromHeader;
    if (requestedVersionFromHeader && requestedVersionFromHeader !== version) {
      response.setHeader(
        'Warning',
        `299 - Requested version "${requestedVersionFromHeader}" is not available; using "${version}"`
      );
    }

    // Check Accept-Version header as fallback for warning
    const acceptVersionHeader = request.headers[API_VERSION_HEADER.toLowerCase()];
    if (acceptVersionHeader && !requestedVersionFromHeader && acceptVersionHeader !== version) {
      response.setHeader(
        'Warning',
        `299 - Requested version "${acceptVersionHeader}" is not available; using "${version}"`
      );
    }

    return next.handle().pipe(
      map((data: any) => {
        // Optionally enrich response with version info (can be disabled if not needed)
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return { ...data, _api: { version } };
        }
        return data;
      })
    );
  }
}
