import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Response } from 'express';
import { Connection, Types, mongo } from 'mongoose';
import { finished } from 'stream/promises';

import { NotFoundServiceException, ValidationServiceException } from '../../common/errors/service.exception';
import { FilesRepository } from './files.repository';

@Injectable()
export class FilesService implements OnModuleInit {
  private bucket!: mongo.GridFSBucket;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly filesRepository: FilesRepository
  ) {}

  onModuleInit() {
    this.bucket = new mongo.GridFSBucket(this.connection.db, { bucketName: 'uploads' });
  }

  async uploadMany(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new ValidationServiceException('Файлы не переданы');
    }

    const results = [];
    for (const file of files) {
      results.push(await this.uploadOne(file));
    }
    return results;
  }

  async uploadOne(file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new ValidationServiceException('Файл пустой');
    }

    const uploadStream = this.bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype
    });

    uploadStream.end(file.buffer);
    await finished(uploadStream);

    return this.filesRepository.create({
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      bucketId: new Types.ObjectId(uploadStream.id.toString())
    });
  }

  async download(id: string, res: Response) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationServiceException('Некорректный идентификатор файла');
    }

    const file = await this.filesRepository.findById(id);
    if (!file) {
      throw new NotFoundServiceException('Файл не найден');
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

    const stream = this.bucket.openDownloadStream(new mongo.ObjectId(file.bucketId.toString()));
    stream.pipe(res);
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationServiceException('Некорректный идентификатор файла');
    }

    const file = await this.filesRepository.delete(id);
    if (!file) {
      throw new NotFoundServiceException('Файл не найден');
    }

    await this.bucket.delete(new mongo.ObjectId(file.bucketId.toString()));
    return { status: 'deleted' };
  }
}
