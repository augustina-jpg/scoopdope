import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('Helmet Security Headers E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          synchronize: true,
          dropSchema: true,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return X-Frame-Options: DENY header', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should return Strict-Transport-Security header with 1-year max-age', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
    expect(response.headers['strict-transport-security']).toContain('preload');
  });

  it('should return Content-Security-Policy header', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['content-security-policy']).toContain("object-src 'none'");
  });

  it('should return X-Content-Type-Options: nosniff header', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should return Referrer-Policy header', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should return security headers on all API routes', async () => {
    const routes = ['/v1/health', '/v1/health/live', '/v1/health/ready'];

    for (const route of routes) {
      const response = await request(app.getHttpServer()).get(route).expect(200);
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    }
  });
});