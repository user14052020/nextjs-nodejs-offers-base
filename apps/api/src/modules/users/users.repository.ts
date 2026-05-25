import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';

import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  private idCandidates(id: string) {
    if (Types.ObjectId.isValid(id)) {
      return [id, new Types.ObjectId(id)];
    }

    return [id];
  }

  async count(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ _id: { $in: this.idCandidates(id) } }).exec();
  }

  async create(user: Pick<User, 'username' | 'passwordHash' | 'role'>): Promise<UserDocument> {
    return this.userModel.create(user);
  }

  async updatePasswordById(id: string, passwordHash: string): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate({ _id: { $in: this.idCandidates(id) } }, { passwordHash }, { new: true })
      .exec();
  }
}
