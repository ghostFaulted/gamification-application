import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UsersImportReport } from '@gamification/shared';
import { Auth } from '../auth/auth.decorator';
import { UsersRepository } from '../db';
import { CsvParserService, MAX_CSV_SIZE_BYTES, type UploadedCsvFile } from './csv-parser.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly csvParser: CsvParserService,
    private readonly usersRepository: UsersRepository,
  ) {}

  @Post('import')
  @HttpCode(HttpStatus.OK)
  // Guards run before the interceptor, so the file is not read for unauthorized users.
  @Auth('lecturer', 'admin')
  // A bigger upload is cut off by multer with 413 instead of being buffered in memory;
  // text fields are not used, so any of them is rejected with 400.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_CSV_SIZE_BYTES, files: 1, fields: 0 } }),
  )
  async importUsers(@UploadedFile() file: UploadedCsvFile | undefined): Promise<UsersImportReport> {
    // Throws 400 for a missing, non-CSV, empty or malformed file.
    const parsed = this.csvParser.parseUsersCsv(file);
    const { createdCount, skippedDuplicatesCount, createdLogins, skippedLogins } =
      await this.usersRepository.bulkInsertStudents(parsed.validLogins);

    return {
      created: createdCount,
      skippedDuplicates: skippedDuplicatesCount,
      createdLogins,
      skippedLogins,
      invalid: parsed.invalidRowsCount,
      errors: parsed.errors,
    };
  }
}
