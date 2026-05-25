import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { ValidationServiceException } from '../../common/errors/service.exception';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('download')
  @Roles('admin')
  async download(@Res() res: Response) {
    const { filename, stream } = this.backupService.createBackupStream();

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    stream.once('error', (error) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'BACKUP_ERROR', message: 'Не удалось сформировать бэкап' });
      } else {
        res.destroy(error instanceof Error ? error : undefined);
      }
    });

    stream.pipe(res);
  }

  @Post('restore')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async restore(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new ValidationServiceException('Файл бэкапа не передан');
    }

    return this.backupService.restoreFromBuffer(file.buffer);
  }
}
