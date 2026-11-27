import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
  ) {}

  async create(createEnrollmentDto: CreateEnrollmentDto): Promise<Enrollment> {
    const enrollment = this.enrollmentsRepository.create(createEnrollmentDto);
    return this.enrollmentsRepository.save(enrollment);
  }

  async findAll(): Promise<Enrollment[]> {
    // Single query: fetch enrollments together with their course via LEFT JOIN.
    // Avoids the N+1 pattern where each enrollment triggered a separate course query.
    return this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.course', 'course')
      .getMany();
  }

  async findOne(id: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.course', 'course')
      .where('enrollment.id = :id', { id })
      .getOne();

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${id} not found`);
    }

    return enrollment;
  }

  async update(
    id: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
  ): Promise<Enrollment> {
    const enrollment = await this.findOne(id);
    Object.assign(enrollment, updateEnrollmentDto);
    return this.enrollmentsRepository.save(enrollment);
  }

  async remove(id: string): Promise<void> {
    const enrollment = await this.findOne(id);
    await this.enrollmentsRepository.remove(enrollment);
  }
}
