import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { File, FileSchema } from './file.schema';
import { FilesController } from './files.controller';
import { FilesRepository } from './files.repository';
import { FilesService } from './files.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: File.name, schema: FileSchema }])],
  controllers: [FilesController],
  providers: [FilesRepository, FilesService],
  exports: [FilesService]
})
export class FilesModule {}
