import { BadRequestException } from '@nestjs/common';
import { CsvParserService, type UploadedCsvFile } from './csv-parser.service';

function makeCsvFile(
  content: string | Buffer,
  originalname = 'students.csv',
  mimetype = 'text/csv',
): UploadedCsvFile {
  return {
    originalname,
    mimetype,
    buffer: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
  };
}

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    service = new CsvParserService();
  });

  it('parses valid logins, normalizes case, and preserves duplicates for DB deduplication', () => {
    const csv = 'login,name\ns123456,Jan\n S123456 ,Anna\nstudent.2,Piotr\n';
    const result = service.parseUsersCsv(makeCsvFile(csv));

    expect(result).toEqual({
      validLogins: ['s123456', 's123456', 'student.2'],
      invalidRowsCount: 0,
      errors: [],
    });
  });

  it('supports UTF-8 BOM, semicolon delimiter, and case-insensitive header', () => {
    const csv = '\uFEFFName;LOGIN;Group\nJan;s111111;G1\nAnna;lecturer_2;G1\n';
    const result = service.parseUsersCsv(
      makeCsvFile(csv, 'export.CSV', 'application/vnd.ms-excel'),
    );

    expect(result).toEqual({
      validLogins: ['s111111', 'lecturer_2'],
      invalidRowsCount: 0,
      errors: [],
    });
  });

  it('reports invalid rows with row numbers and reasons while keeping valid logins', () => {
    const longLogin = 'a'.repeat(65);
    const csv = [
      'login,email',
      's100001,ok@amu.edu.pl',
      ',missing@amu.edu.pl',
      'bad login,space@amu.edu.pl',
      `${longLogin},toolong@amu.edu.pl`,
      'bad@email,at@amu.edu.pl',
      's100002,ok2@amu.edu.pl',
    ].join('\n');

    const result = service.parseUsersCsv(makeCsvFile(csv));

    expect(result.validLogins).toEqual(['s100001', 's100002']);
    expect(result.invalidRowsCount).toBe(4);
    expect(result.errors).toEqual([
      { row: 3, value: '', reason: 'Login is empty' },
      { row: 4, value: 'bad login', reason: 'Login contains invalid characters' },
      { row: 5, value: longLogin, reason: 'Login exceeds 64 characters' },
      { row: 6, value: 'bad@email', reason: 'Login contains invalid characters' },
    ]);
  });

  it('reports source line numbers when blank lines are skipped', () => {
    const csv = ['login', '', 's100001', '', '', 'bad login', '  ', 's100002', ''].join('\n');

    const result = service.parseUsersCsv(makeCsvFile(csv));

    expect(result.validLogins).toEqual(['s100001', 's100002']);
    expect(result.errors).toEqual([
      { row: 6, value: 'bad login', reason: 'Login contains invalid characters' },
    ]);
  });

  it('reports source line numbers for CRLF files', () => {
    const csv = ['login', 's100001', '', 'bad login', 's100002'].join('\r\n');

    const result = service.parseUsersCsv(makeCsvFile(csv));

    expect(result.errors).toEqual([
      { row: 4, value: 'bad login', reason: 'Login contains invalid characters' },
    ]);
  });

  it('does not merge rows when a CRLF file contains a stray LF or CR', () => {
    const result = service.parseUsersCsv(
      makeCsvFile('login,name\r\ns1,\ns2,John\r\ns3,\rbad login,\r\n'),
    );

    expect(result.validLogins).toEqual(['s1', 's2', 's3']);
    expect(result.errors).toEqual([
      { row: 5, value: 'bad login', reason: 'Login contains invalid characters' },
    ]);
  });

  it('rejects quoted line breaks in CRLF files', () => {
    expect(() => service.parseUsersCsv(makeCsvFile('login\r\n"bad\r\nlogin"\r\ns1\r\n'))).toThrow(
      'CSV values must not contain line breaks',
    );
  });

  it('rejects values that span several lines', () => {
    const csv = ['login', '"bad', 'login"', 's100001'].join('\n');

    expect(() => service.parseUsersCsv(makeCsvFile(csv))).toThrow(
      'CSV values must not contain line breaks',
    );
  });

  it('rejects missing file', () => {
    expect(() => service.parseUsersCsv(undefined)).toThrow(BadRequestException);
  });

  it('rejects non-csv extension', () => {
    expect(() =>
      service.parseUsersCsv(makeCsvFile('login\ns123456\n', 'students.xlsx', 'text/csv')),
    ).toThrow('Invalid file extension. Only .csv files are allowed');
  });

  it('rejects disallowed MIME type', () => {
    expect(() =>
      service.parseUsersCsv(makeCsvFile('login\ns123456\n', 'students.csv', 'application/pdf')),
    ).toThrow('Invalid file MIME type. Expected a CSV file');
  });

  it('rejects empty file and whitespace-only file', () => {
    expect(() => service.parseUsersCsv(makeCsvFile(''))).toThrow('CSV file is empty');
    expect(() => service.parseUsersCsv(makeCsvFile('   \n  \r\n'))).toThrow('CSV file is empty');
  });

  it('rejects invalid UTF-8 and binary buffers', () => {
    expect(() => service.parseUsersCsv(makeCsvFile(Buffer.from([0x6c, 0x6f, 0x00, 0x67])))).toThrow(
      'Invalid file content. Expected a UTF-8 CSV file',
    );

    expect(() => service.parseUsersCsv(makeCsvFile(Buffer.from([0xff, 0xfe, 0xfd])))).toThrow(
      'CSV file must be encoded in valid UTF-8',
    );
  });

  it('rejects CSV without "login" header or with duplicate "login" headers', () => {
    expect(() => service.parseUsersCsv(makeCsvFile('email,name\na@b.pl,Jan\n'))).toThrow(
      'CSV file is missing required "login" header',
    );

    expect(() => service.parseUsersCsv(makeCsvFile('login,LOGIN\ns1,s2\n'))).toThrow(
      'CSV file contains duplicate "login" header columns',
    );
  });

  it('rejects malformed CSV with unclosed quotes', () => {
    expect(() => service.parseUsersCsv(makeCsvFile('login\n"unclosed\n'))).toThrow(
      BadRequestException,
    );
  });

  it('treats semicolons as literal characters in comma-separated CSVs', () => {
    const csv = ['"notes;meta",login', 'Doe;John,s123456', '"Smith;Jane",s654321'].join('\n');

    const result = service.parseUsersCsv(makeCsvFile(csv));

    expect(result).toEqual({
      validLogins: ['s123456', 's654321'],
      invalidRowsCount: 0,
      errors: [],
    });
  });

  it('treats commas as literal characters in semicolon-separated CSVs', () => {
    const csv = ['"notes, meta";login', 'Doe, John;s123456', '"Smith, Jane";s654321'].join('\n');

    const result = service.parseUsersCsv(makeCsvFile(csv));

    expect(result).toEqual({
      validLogins: ['s123456', 's654321'],
      invalidRowsCount: 0,
      errors: [],
    });
  });

  it('prefers semicolon when comma parsing would invent duplicate login headers', () => {
    const csv = 'login,login,notes;login\nfoo,bar,baz;s123456\n';

    const result = service.parseUsersCsv(makeCsvFile(csv));

    expect(result).toEqual({
      validLogins: ['s123456'],
      invalidRowsCount: 0,
      errors: [],
    });
  });
});
