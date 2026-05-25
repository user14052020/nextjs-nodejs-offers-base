import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UnauthorizedServiceException } from '../../common/errors/service.exception';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedServiceException('Неверный логин или пароль');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedServiceException('Неверный логин или пароль');
    }

    const payload = { sub: user._id.toString(), username: user.username, role: user.role as UserRole };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: { id: user._id.toString(), username: user.username, role: user.role as UserRole }
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    return this.usersService.changePassword(userId, oldPassword, newPassword);
  }
}
