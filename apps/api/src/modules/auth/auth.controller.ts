import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() request: Request & { user: { userId: string } },
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(request.user.userId, dto.oldPassword, dto.newPassword);
  }
}
