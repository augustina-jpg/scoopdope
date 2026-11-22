import { INestApplication } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Minimal, dependency-free OpenAPI 3.0 specification for the backend API.
 * Served as JSON at `/api/docs` and rendered by a small built-in HTML page
 * at `/api/docs/ui` so no extra Swagger packages are required.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Backend API',
    description: 'OpenAPI documentation for the backend REST API.',
    version: '1.0.0',
  },
  servers: [{ url: '/api', description: 'API base path' }],
  tags: [
    { name: 'Lessons', description: 'Lesson management endpoints' },
    { name: 'Forums', description: 'Forum thread endpoints' },
    { name: 'Payments', description: 'Payment and invoice endpoints' },
  ],
  paths: {
    '/forums/threads': {
      get: {
        tags: ['Forums'],
        summary: 'List forum threads',
        description:
          'Cursor-based pagination. Pass the `nextCursor` value from a previous response as `after` to fetch the next page.',
        operationId: 'listForumThreads',
        parameters: [
          {
            name: 'after',
            in: 'query',
            required: false,
            description:
              'Opaque base64-encoded cursor of the form `<base64-encoded-ISO-timestamp>_<id>`. Omit to start from the first page.',
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum number of threads to return.',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'A page of forum threads',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ForumThreadPage' },
              },
            },
          },
          '400': { description: 'Invalid cursor or limit' },
        },
      },
    },
    '/payments/{id}/invoice': {
      get: {
        tags: ['Payments'],
        summary: 'Download the tax-inclusive invoice PDF for a payment',
        operationId: 'getPaymentInvoice',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description:
              'The invoice PDF. Tax-inclusive fields (taxRate, taxAmount, taxJurisdiction, subtotal, total) are rendered in the document.',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '404': { description: 'Payment not found' },
        },
      },
    },
=======
    '/lessons': {
      get: {
        tags: ['Lessons'],
        summary: 'List lessons',
        operationId: 'listLessons',
        responses: {
          '200': {
            description: 'A list of lessons',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Lesson' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Lessons'],
        summary: 'Create a lesson',
        operationId: 'createLesson',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateLessonDto' },
            },
          },
        },
        responses: {
          '201': {
            description: 'The created lesson',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Lesson' },
              },
            },
          },
          '400': { description: 'Invalid lesson payload' },
        },
      },
    },
    '/lessons/{id}': {
      get: {
        tags: ['Lessons'],
        summary: 'Get a lesson by id',
        operationId: 'getLesson',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'The requested lesson',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Lesson' },
              },
            },
          },
          '404': { description: 'Lesson not found' },
        },
      },
    },
  },
  components: {
    schemas: {
      Lesson: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'title'],
      },
      CreateLessonDto: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
        },
        required: ['title'],
      },
      ForumThread: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'title', 'createdAt'],
      },
      ForumThreadPage: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/ForumThread' },
          },
          nextCursor: {
            type: 'string',
            nullable: true,
            description:
              'Cursor for the next page, or null when there are no more results.',
          },
          hasMore: { type: 'boolean' },
        },
        required: ['data', 'hasMore'],
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          subtotal: { type: 'number', format: 'double' },
          taxRate: { type: 'number', format: 'double' },
          taxAmount: { type: 'number', format: 'double' },
          taxJurisdiction: { type: 'string' },
          total: { type: 'number', format: 'double' },
          currency: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'id',
          'subtotal',
          'taxRate',
          'taxAmount',
          'taxJurisdiction',
          'total',
        ],
      },
      Invoice: {
        type: 'object',
        properties: {
          paymentId: { type: 'string' },
          subtotal: { type: 'number', format: 'double' },
          taxRate: { type: 'number', format: 'double' },
          taxAmount: { type: 'number', format: 'double' },
          taxJurisdiction: { type: 'string' },
          total: { type: 'number', format: 'double' },
          currency: { type: 'string' },
          issuedAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'paymentId',
          'subtotal',
          'taxRate',
          'taxAmount',
          'taxJurisdiction',
          'total',
        ],
      },
    },
  },
} as const;

const docsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Backend API Docs</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2933; }
  h1 { font-size: 1.5rem; }
  code { background: #f5f7fa; padding: 0.1rem 0.3rem; border-radius: 4px; }
  a { color: #2563eb; }
</style>
</head>
<body>
<h1>Backend API Documentation</h1>
<p>OpenAPI 3.0 specification is available as JSON at <a href="/api/docs"><code>/api/docs</code></a>.</p>
<p>Import that URL into any OpenAPI/Swagger-compatible tool to explore the API.</p>
</body>
</html>`;

/**
 * Registers the API documentation routes on the given Nest application.
 * - GET /api/docs     -> OpenAPI JSON spec
 * - GET /api/docs/ui  -> lightweight HTML landing page
 */
export function setupApiDocs(app: INestApplication): void {
  const httpAdapter = app.getHttpAdapter();

  httpAdapter.get('/api/docs', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  httpAdapter.get('/api/docs/ui', (_req: Request, res: Response) => {
    res.type('text/html').send(docsHtml);
  });
}
