import { BadRequestException } from '@nestjs/common';
import {
  MAX_COURSE_CODE_LENGTH,
  MAX_COURSE_NAME_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUP_SEMESTER_LENGTH,
  parseCreateCourseBody,
  parseCreateGroupBody,
  parseUpdateGroupBody,
  parseUuid,
} from './groups.validation';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('groups.validation', () => {
  it('validates and normalizes UUIDs', () => {
    expect(parseUuid(`  ${VALID_UUID.toUpperCase()} `, 'id')).toBe(VALID_UUID);
    expect(() => parseUuid('not-a-uuid', 'id')).toThrow(BadRequestException);
    expect(() => parseUuid(123, 'id')).toThrow(BadRequestException);
  });

  it('parses valid create course payloads and turns blank optional fields into null', () => {
    expect(
      parseCreateCourseBody({
        name: '  Inżynieria oprogramowania  ',
        code: '  06INFS  ',
        description: '   ',
      }),
    ).toEqual({
      name: 'Inżynieria oprogramowania',
      code: '06INFS',
      description: null,
    });
  });

  it('rejects invalid course payloads', () => {
    expect(() => parseCreateCourseBody(null)).toThrow(BadRequestException);
    expect(() => parseCreateCourseBody({ name: '   ' })).toThrow(BadRequestException);
    expect(() => parseCreateCourseBody({ name: 'a'.repeat(MAX_COURSE_NAME_LENGTH + 1) })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseCreateCourseBody({ name: 'OK', code: 'x'.repeat(MAX_COURSE_CODE_LENGTH + 1) }),
    ).toThrow(BadRequestException);
  });

  it('parses valid create group payloads', () => {
    expect(
      parseCreateGroupBody({
        courseId: VALID_UUID,
        name: '  Grupa 1 ',
        semester: ' 2026/27-Z ',
        description: 'Wtorek 10:15',
      }),
    ).toEqual({
      courseId: VALID_UUID,
      name: 'Grupa 1',
      semester: '2026/27-Z',
      description: 'Wtorek 10:15',
    });
  });

  it('rejects invalid create group payloads', () => {
    expect(() => parseCreateGroupBody({ courseId: 'bad', name: 'G1' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseCreateGroupBody({ courseId: VALID_UUID, name: 'x'.repeat(MAX_GROUP_NAME_LENGTH + 1) }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseCreateGroupBody({
        courseId: VALID_UUID,
        name: 'G1',
        semester: 'x'.repeat(MAX_GROUP_SEMESTER_LENGTH + 1),
      }),
    ).toThrow(BadRequestException);
  });

  it('parses partial update payloads and rejects empty patches', () => {
    expect(parseUpdateGroupBody({ name: '  Nowa nazwa ', semester: null })).toEqual({
      name: 'Nowa nazwa',
      semester: null,
    });
    expect(() => parseUpdateGroupBody({})).toThrow(BadRequestException);
    expect(() => parseUpdateGroupBody({ unknown: 'field' })).toThrow(BadRequestException);
  });
});
