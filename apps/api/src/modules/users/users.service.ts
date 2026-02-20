import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { NotFoundServiceException, UnauthorizedServiceException } from '../../common/errors/service.exception';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly usersRepository: UsersRepository) {}

  async onModuleInit() {
    const count = await this.usersRepository.count();
    if (count === 0) {
      const passwordHash = await bcrypt.hash('admin', 10);
      await this.usersRepository.create({ username: 'admin', passwordHash, role: 'admin' });
    }
  }

  async findByUsername(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundServiceException('Пользователь не найден');
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedServiceException('Текущий пароль неверный');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.updatePasswordById(userId, passwordHash);
    return { status: 'ok' };
  }
}
