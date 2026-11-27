import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string, includeDeleted = false): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  /**
   * Soft-deletes a user by setting `deleted_at` instead of removing the row.
   * Preserves enrollment history, credential records, and audit trails.
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.softRemove(user);
  }

  /**
   * Learner self-deletion. Anonymizes personally identifiable fields while
   * retaining the row (and its relations) for the audit retention period.
   */
  async selfDelete(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.email = `deleted+${user.id}@anonymized.invalid`;
    user.firstName = 'Deleted';
    user.lastName = 'User';
    await this.usersRepository.save(user);
    await this.usersRepository.softRemove(user);
  }

  async restore(id: string): Promise<User> {
    const user = await this.findOne(id, true);
    if (!user.deletedAt) {
      throw new ForbiddenException('User is not deleted');
    }
    return this.usersRepository.recover(user);
  }
}
