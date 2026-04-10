import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const exists = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (exists) {
      throw new ConflictException(`E-mail ${normalizedEmail} já está em uso.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      ...dto,
      email: normalizedEmail,
      passwordHash,
      status: UserStatus.ACTIVE,
    });
    return this.userRepo.save(user);
  }

  async findAll(): Promise<UserEntity[]> {
    return this.userRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new EntityNotFoundException('Usuário', id);
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    if (dto.password) {
      (dto as any).passwordHash = await bcrypt.hash(dto.password, 10);
      delete dto.password;
    }
    if (dto.email) {
      dto.email = this.normalizeEmail(dto.email);
    }
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }
}
