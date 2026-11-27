import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { Enrollment } from './entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { EnrollmentsModule } from './enrollments.module';
import { EnrollmentsService } from './enrollments.service';

describe('GET /v1/enrollments (integration)', () => {
  let app: INestApplication;
  let enrollmentRepository: Repository<Enrollment>;
  let courseRepository: Repository<Course>;
  let queryCount: number;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Enrollment, Course],
          synchronize: true,
          logging: ['query'],
          logger: {
            logQuery: () => {
              queryCount += 1;
            },
            logQueryError: () => undefined,
            logQuerySlow: () => undefined,
            logSchemaBuild: () => undefined,
            logMigration: () => undefined,
            log: () => undefined,
          },
        }),
        EnrollmentsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    enrollmentRepository = moduleRef.get<Repository<Enrollment>>(
      getRepositoryToken(Enrollment),
    );
    courseRepository = moduleRef.get<Repository<Course>>(
      getRepositoryToken(Course),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await enrollmentRepository.clear();
    await courseRepository.clear();
  });

  it('issues only one SQL query for the enrollment list', async () => {
    const course = await courseRepository.save(
      courseRepository.create({ title: 'Intro to TypeORM' }),
    );

    const enrollments = Array.from({ length: 100 }, (_, i) =>
      enrollmentRepository.create({
        userId: `user-${i}`,
        courseId: course.id,
        course,
      }),
    );
    await enrollmentRepository.save(enrollments);

    queryCount = 0;

    const response = await request(app.getHttpServer())
      .get('/v1/enrollments')
      .expect(200);

    expect(response.body).toHaveLength(100);
    expect(queryCount).toBe(1);
  });

  it('returns enrollments with their associated course loaded', async () => {
    const course = await courseRepository.save(
      courseRepository.create({ title: 'Advanced TypeORM' }),
    );
    await enrollmentRepository.save(
      enrollmentRepository.create({
        userId: 'user-1',
        courseId: course.id,
        course,
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/v1/enrollments')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].course).toBeDefined();
    expect(response.body[0].course.id).toBe(course.id);
  });
});
