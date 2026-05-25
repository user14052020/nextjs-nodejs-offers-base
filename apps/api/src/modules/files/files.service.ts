import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Response } from 'express';
import { Connection, Types, mongo } from 'mongoose';
import { finished } from 'stream/promises';

import { NotFoundServiceException, ValidationServiceException } from '../../common/errors/service.exception';
import { FilesRepository } from './files.repository';

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
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

    const bucketId = this.toObjectId(file.bucketId);
    if (!bucketId) {
      throw new ValidationServiceException('Некорректный идентификатор файла в хранилище');
    }

    const gridFsFile = await this.connection.db.collection('uploads.files').findOne({ _id: bucketId } as any);
    if (!gridFsFile) {
      throw new NotFoundServiceException('Файл в хранилище не найден');
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

    const stream = this.bucket.openDownloadStream(new mongo.ObjectId(bucketId.toHexString()));
    stream.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to stream file ${id}: ${message}`);

      if (!res.headersSent) {
        res.status(404).json({ message: 'Файл в хранилище не найден' });
        return;
      }

      if (!res.writableEnded) {
        res.end();
      }
    });

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

    const bucketId = this.toObjectId(file.bucketId);
    if (bucketId) {
      try {
        await this.bucket.delete(new mongo.ObjectId(bucketId.toHexString()));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('FileNotFound')) {
          throw error;
        }
      }
    }

    return { status: 'deleted' };
  }

  private toObjectId(value: unknown): Types.ObjectId | null {
    if (value instanceof Types.ObjectId) {
      return value;
    }

    if (value instanceof mongo.ObjectId) {
      return new Types.ObjectId(value.toHexString());
    }

    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }

    if (value && typeof value === 'object') {
      const candidate = value as { _id?: unknown; id?: unknown; $oid?: unknown };
      if (typeof candidate.$oid === 'string' && Types.ObjectId.isValid(candidate.$oid)) {
        return new Types.ObjectId(candidate.$oid);
      }
      if (typeof candidate._id === 'string' && Types.ObjectId.isValid(candidate._id)) {
        return new Types.ObjectId(candidate._id);
      }
      if (typeof candidate.id === 'string' && Types.ObjectId.isValid(candidate.id)) {
        return new Types.ObjectId(candidate.id);
      }
    }

    return null;
  }
}
