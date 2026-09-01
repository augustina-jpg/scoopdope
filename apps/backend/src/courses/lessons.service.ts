import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Lesson } from './lesson.entity';
import { SearchService } from '../search/search.service';
import { TranscribeService } from './transcribe.service';
import { Interval } from '@nestjs/schedule';
import { Course } from './course.entity';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    @InjectRepository(Lesson) private repo: Repository<Lesson>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    private readonly searchService: SearchService,
    private readonly transcribeService: TranscribeService,
  ) {}

  findByModule(moduleId: string) {
    return this.repo.find({ where: { moduleId }, order: { order: 'ASC' } });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(moduleId: string, data: Partial<Lesson>) {
    const lesson = await this.repo.save(this.repo.create({ ...data, moduleId }));
    await this.searchService.indexLesson(lesson).catch(() => {});
    
    if (lesson.videoUrl) {
      this.triggerTranscription(lesson);
    }
    
    return lesson;
  }

  async update(id: string, data: Partial<Lesson>) {
    const lesson = await this.findOne(id);
    if (!lesson) throw new NotFoundException('Lesson not found');
    
    const oldVideoUrl = lesson.videoUrl;
    const updated = await this.repo.save({ ...lesson, ...data });
    await this.searchService.indexLesson(updated).catch(() => {});
    
    if (updated.videoUrl && updated.videoUrl !== oldVideoUrl) {
      this.triggerTranscription(updated);
    }
    
    return updated;
  }

  private async triggerTranscription(lesson: Lesson) {
    try {
      const jobName = await this.transcribeService.startTranscription(lesson.id, lesson.videoUrl);
      await this.repo.update(lesson.id, { transcriptionJobName: jobName });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to trigger transcription for lesson ${lesson.id}: ${message}`);
    }
  }

  @Interval(60000) // Every 1 minute
  async checkTranscriptionJobs() {
    const lessons = await this.repo.find({
      where: {
        transcriptionJobName: Not(IsNull()),
        transcript: IsNull(),
      },
    });

    for (const lesson of lessons) {
      try {
        const result = await this.transcribeService.getTranscriptionResult(lesson.transcriptionJobName);
        if (result && typeof result !== 'string') {
          // COMPLETED
          const srt = this.transcribeService.convertToSrt(result);
          await this.repo.update(lesson.id, {
            transcript: result,
            transcriptSrt: srt,
          });
          this.logger.log(`Transcription completed for lesson ${lesson.id}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error checking transcription for lesson ${lesson.id}: ${message}`);
      }
    }
  }

  async remove(id: string) {
    const lesson = await this.findOne(id);
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.searchService.deleteFromIndex('lessons', id).catch(() => {});
    return this.repo.remove(lesson);
  }

  /**
   * Validates that an instructor teaches the course containing a lesson.
   * @param lessonId - The ID of the lesson
   * @param instructorId - The ID of the instructor
   * @returns The lesson if validation passes
   * @throws NotFoundException if lesson doesn't exist
   * @throws ForbiddenException if instructor doesn't teach the course
   */
  async validateInstructorOwnsLesson(lessonId: string, instructorId: string): Promise<Lesson> {
    const lesson = await this.repo.findOne({
      where: { id: lessonId },
      relations: ['module', 'module.course', 'module.course.instructor'],
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check if instructor teaches the course
    if (lesson.module?.course?.instructorId !== instructorId) {
      throw new ForbiddenException('You do not teach the course containing this lesson');
    }

    return lesson;
  }

  /**
   * Updates lesson content with validation.
   * @param id - The ID of the lesson
   * @param instructorId - The ID of the instructor performing the update
   * @param data - Partial lesson data to update
   * @returns The updated lesson
   * @throws NotFoundException if lesson doesn't exist
   * @throws ForbiddenException if instructor doesn't teach the course
   */
  async updateContent(id: string, instructorId: string, data: Partial<Lesson>) {
    // Validate instructor ownership
    const lesson = await this.validateInstructorOwnsLesson(id, instructorId);

    // Update allowed fields only
    const updateData: Partial<Lesson> = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.learningObjectives !== undefined) updateData.learningObjectives = data.learningObjectives;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;

    const updated = await this.repo.save({ ...lesson, ...updateData });
    await this.searchService.indexLesson(updated).catch(() => {});

    return updated;
  }
}
