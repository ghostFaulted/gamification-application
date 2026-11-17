import path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CsvError, parse } from 'csv-parse/sync';

export interface UploadedCsvFile {
  originalname: string;
  mimetype?: string;
  buffer: Buffer;
}

export interface CsvRowError {
  row: number;
  value: string;
  reason: string;
}

export interface ParsedUsersCsvResult {
  validLogins: string[];
  invalidRowsCount: number;
  errors: CsvRowError[];
}

type CsvDelimiter = ',' | ';';

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_LOGIN_LENGTH = 64;
const LOGIN_PATTERN = /^[a-z0-9._-]+$/;
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

@Injectable()
export class CsvParserService {
  parseUsersCsv(file: UploadedCsvFile | undefined): ParsedUsersCsvResult {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      throw new BadRequestException('Invalid file extension. Only .csv files are allowed');
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException('Invalid file MIME type. Expected a CSV file');
    }

    if (file.buffer.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    if (file.buffer.length > MAX_CSV_SIZE_BYTES) {
      throw new BadRequestException('CSV file exceeds maximum allowed size of 5 MB');
    }

    if (file.buffer.includes(0)) {
      throw new BadRequestException('Invalid file content. Expected a UTF-8 CSV file');
    }

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException('CSV file must be encoded in valid UTF-8');
    }

    const delimiter = this.detectDelimiter(text);

    let records: string[][];
    try {
      records = parse(text, {
        bom: true,
        delimiter,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }) as string[][];
    } catch (error) {
      if (error instanceof CsvError) {
        throw new BadRequestException(`Malformed CSV file: ${error.message}`);
      }
      throw error;
    }

    if (records.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    const headers = records[0].map((header) => header.trim().toLowerCase());
    const loginIndices = headers.reduce<number[]>((acc, header, index) => {
      if (header === 'login') {
        acc.push(index);
      }
      return acc;
    }, []);

    if (loginIndices.length === 0) {
      throw new BadRequestException('CSV file is missing required "login" header');
    }

    if (loginIndices.length > 1) {
      throw new BadRequestException('CSV file contains duplicate "login" header columns');
    }

    const loginColumnIndex = loginIndices[0];
    const validLogins: string[] = [];
    const errors: CsvRowError[] = [];

    for (let i = 1; i < records.length; i += 1) {
      const row = records[i];
      const rowNumber = i + 1;
      const rawValue = row[loginColumnIndex] ?? '';
      const normalized = rawValue.trim().toLowerCase();

      if (normalized.length === 0) {
        errors.push({ row: rowNumber, value: rawValue, reason: 'Login is empty' });
        continue;
      }

      if (normalized.length > MAX_LOGIN_LENGTH) {
        errors.push({
          row: rowNumber,
          value: rawValue,
          reason: `Login exceeds ${MAX_LOGIN_LENGTH} characters`,
        });
        continue;
      }

      if (!LOGIN_PATTERN.test(normalized)) {
        errors.push({
          row: rowNumber,
          value: rawValue,
          reason: 'Login contains invalid characters',
        });
        continue;
      }

      validLogins.push(normalized);
    }

    return {
      validLogins,
      invalidRowsCount: errors.length,
      errors,
    };
  }

  private detectDelimiter(text: string): CsvDelimiter {
    const candidates: CsvDelimiter[] = [',', ';'];
    let bestDelimiter: CsvDelimiter = ',';
    let bestScore = -1;

    for (const delimiter of candidates) {
      const header = this.parseHeaderWithDelimiter(text, delimiter);
      if (!header) {
        continue;
      }

      const loginCount = header.filter((h) => h.trim().toLowerCase() === 'login').length;
      // Prefer exactly one "login" column so a semicolon file whose first cell
      // contains commas is not mistaken for a comma CSV with duplicate headers.
      const score = (loginCount === 1 ? 2000 : loginCount > 0 ? 1000 : 0) + header.length;

      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delimiter;
      }
    }

    return bestDelimiter;
  }

  private parseHeaderWithDelimiter(text: string, delimiter: CsvDelimiter): string[] | null {
    try {
      const records = parse(text, {
        bom: true,
        delimiter,
        trim: true,
        skip_empty_lines: true,
        to: 1,
      }) as string[][];

      return records[0] ?? null;
    } catch (error) {
      if (error instanceof CsvError) {
        return null;
      }
      throw error;
    }
  }
}
