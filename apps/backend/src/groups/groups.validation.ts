import { BadRequestException } from '@nestjs/common';
import type {
  CreateCourseRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
} from '@gamification/shared';

export const MAX_COURSE_NAME_LENGTH = 160;
export const MAX_COURSE_CODE_LENGTH = 64;
export const MAX_GROUP_NAME_LENGTH = 120;
export const MAX_GROUP_SEMESTER_LENGTH = 32;
export const MAX_DESCRIPTION_LENGTH = 2000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertPlainObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

export function parseUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new BadRequestException(`${fieldName} must be a valid UUID`);
  }
  return value.trim().toLowerCase();
}

function parseRequiredText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(`${fieldName} must not be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${fieldName} must not exceed ${maxLength} characters`);
  }
  return trimmed;
}

function parseOptionalNullableText(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string or null`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${fieldName} must not exceed ${maxLength} characters`);
  }
  return trimmed;
}

export interface ValidatedCreateCourseInput {
  name: string;
  code: string | null;
  description: string | null;
}

export function parseCreateCourseBody(rawBody: unknown): ValidatedCreateCourseInput {
  const body = assertPlainObject(rawBody) as Partial<Record<keyof CreateCourseRequest, unknown>>;

  return {
    name: parseRequiredText(body.name, 'name', MAX_COURSE_NAME_LENGTH),
    code: parseOptionalNullableText(body.code, 'code', MAX_COURSE_CODE_LENGTH) ?? null,
    description:
      parseOptionalNullableText(body.description, 'description', MAX_DESCRIPTION_LENGTH) ?? null,
  };
}

export interface ValidatedCreateGroupInput {
  courseId: string;
  name: string;
  semester: string | null;
  description: string | null;
  lecturerId?: string;
}

export function parseCreateGroupBody(rawBody: unknown): ValidatedCreateGroupInput {
  const body = assertPlainObject(rawBody) as Partial<Record<keyof CreateGroupRequest, unknown>>;

  const input: ValidatedCreateGroupInput = {
    courseId: parseUuid(body.courseId, 'courseId'),
    name: parseRequiredText(body.name, 'name', MAX_GROUP_NAME_LENGTH),
    semester:
      parseOptionalNullableText(body.semester, 'semester', MAX_GROUP_SEMESTER_LENGTH) ?? null,
    description:
      parseOptionalNullableText(body.description, 'description', MAX_DESCRIPTION_LENGTH) ?? null,
  };

  if (body.lecturerId !== undefined) {
    input.lecturerId = parseUuid(body.lecturerId, 'lecturerId');
  }

  return input;
}

export interface ValidatedUpdateGroupInput {
  name?: string;
  semester?: string | null;
  description?: string | null;
}

export function parseUpdateGroupBody(rawBody: unknown): ValidatedUpdateGroupInput {
  const body = assertPlainObject(rawBody) as Partial<Record<keyof UpdateGroupRequest, unknown>>;
  const result: ValidatedUpdateGroupInput = {};

  if (body.name !== undefined) {
    result.name = parseRequiredText(body.name, 'name', MAX_GROUP_NAME_LENGTH);
  }
  if (body.semester !== undefined) {
    result.semester =
      parseOptionalNullableText(body.semester, 'semester', MAX_GROUP_SEMESTER_LENGTH) ?? null;
  }
  if (body.description !== undefined) {
    result.description =
      parseOptionalNullableText(body.description, 'description', MAX_DESCRIPTION_LENGTH) ?? null;
  }

  if (Object.keys(result).length === 0) {
    throw new BadRequestException(
      'At least one updatable field (name, semester, description) is required',
    );
  }

  return result;
}
