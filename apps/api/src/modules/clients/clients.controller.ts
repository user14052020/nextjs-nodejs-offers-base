import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { ValidationServiceException } from '../../common/errors/service.exception';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FilesService } from '../files/files.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly filesService: FilesService
  ) {}

  @Get()
  findAll(@Query('q') query?: string) {
    return this.clientsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findById(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  @Post(':id/files')
  @Roles('admin')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFiles(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    const uploaded = await this.filesService.uploadMany(files);
    for (const file of uploaded) {
      await this.clientsService.attachFile(id, new Types.ObjectId(file._id));
    }
    return uploaded;
  }

  @Delete(':id/files/:fileId')
  @Roles('admin')
  async removeFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    if (!Types.ObjectId.isValid(fileId)) {
      throw new ValidationServiceException('Некорректный идентификатор файла');
    }

    await this.clientsService.detachFile(id, new Types.ObjectId(fileId));
    return this.filesService.delete(fileId);
  }
}
