import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UsersService email normalization', () => {
  const userRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const service = new UsersService(userRepo as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    userRepo.create.mockImplementation((payload: unknown) => payload);
    userRepo.save.mockImplementation(async (payload: unknown) => payload);
  });

  it('normalizes e-mail when searching by email', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await service.findByEmail('  ADMIN@OTIMIZ.COM  ');

    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'admin@otimiz.com' },
    });
  });

  it('normalizes e-mail before creating a user', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await service.create({
      name: 'Administrador',
      email: '  ADMIN@OTIMIZ.COM  ',
      password: '123456',
      role: 'super_admin' as any,
      companyId: 1,
    });

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@otimiz.com' }),
    );
  });

  it('detects conflicts using normalized email', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1, email: 'admin@otimiz.com' });

    await expect(
      service.create({
        name: 'Administrador',
        email: 'ADMIN@OTIMIZ.COM',
        password: '123456',
        role: 'super_admin' as any,
        companyId: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
