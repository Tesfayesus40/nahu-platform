import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const MAX_PHOTOS = 5;

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  async saveListingPhoto(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    const uploadDir = this.config.get<string>('storage.uploadDir')!;
    const publicBase = this.config.get<string>('storage.publicBaseUrl')!;

    const ext = extname(file.originalname) || this.mimeToExt(file.mimetype);
    const filename = `${randomUUID()}${ext}`;

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), file.buffer);

    const url = `${publicBase}/uploads/files/${filename}`;
    return { url };
  }

  get maxPhotos() {
    return MAX_PHOTOS;
  }

  private mimeToExt(mime: string) {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/heic' || mime === 'image/heif') return '.heic';
    return '.jpg';
  }
}
