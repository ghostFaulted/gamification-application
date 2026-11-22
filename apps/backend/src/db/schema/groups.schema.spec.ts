import { getTableConfig } from 'drizzle-orm/pg-core';
import { courses } from './courses.js';
import { groupStudents } from './group-students.js';
import { groups } from './groups.js';

describe('courses, groups and group_students Drizzle schema', () => {
  it('defines courses table with partial unique code index and optional creator FK', () => {
    const config = getTableConfig(courses);

    expect(config.name).toBe('courses');
    expect(config.columns.map((c) => c.name)).toEqual([
      'id',
      'name',
      'code',
      'description',
      'createdBy',
      'createdAt',
      'updatedAt',
    ]);

    const nameCol = config.columns.find((c) => c.name === 'name');
    const codeCol = config.columns.find((c) => c.name === 'code');
    expect(nameCol?.notNull).toBe(true);
    expect(codeCol?.notNull).toBe(false);

    expect(config.indexes.map((i) => ({ name: i.config.name, unique: i.config.unique }))).toEqual([
      { name: 'courses_code_unique', unique: true },
    ]);

    expect(config.foreignKeys).toHaveLength(1);
    expect(getTableConfig(config.foreignKeys[0].reference().foreignTable).name).toBe('users');
    expect(config.foreignKeys[0].onDelete).toBe('set null');
  });

  it('defines groups table with course and lecturer FKs and required indexes', () => {
    const config = getTableConfig(groups);

    expect(config.name).toBe('groups');
    expect(config.columns.map((c) => c.name)).toEqual([
      'id',
      'courseId',
      'lecturerId',
      'name',
      'semester',
      'description',
      'createdAt',
      'updatedAt',
    ]);

    const fks = config.foreignKeys.map((fk) => ({
      table: getTableConfig(fk.reference().foreignTable).name,
      onDelete: fk.onDelete,
    }));
    expect(fks).toEqual([
      { table: 'courses', onDelete: 'cascade' },
      { table: 'users', onDelete: 'restrict' },
    ]);

    expect(config.indexes.map((i) => ({ name: i.config.name, unique: i.config.unique }))).toEqual([
      { name: 'groups_course_id_idx', unique: false },
      { name: 'groups_lecturer_id_idx', unique: false },
      { name: 'groups_course_name_unique', unique: true },
    ]);
  });

  it('defines group_students join table with composite PK, cascade FKs and student index', () => {
    const config = getTableConfig(groupStudents);

    expect(config.name).toBe('group_students');
    expect(config.columns.map((c) => c.name)).toEqual(['groupId', 'studentId', 'assignedAt']);

    expect(config.primaryKeys).toHaveLength(1);
    expect(config.primaryKeys[0].name).toBe('group_students_pk');
    expect(config.primaryKeys[0].columns.map((c) => c.name)).toEqual(['groupId', 'studentId']);

    const fks = config.foreignKeys.map((fk) => ({
      table: getTableConfig(fk.reference().foreignTable).name,
      onDelete: fk.onDelete,
    }));
    expect(fks).toEqual([
      { table: 'groups', onDelete: 'cascade' },
      { table: 'users', onDelete: 'cascade' },
    ]);

    expect(config.indexes.map((i) => ({ name: i.config.name, unique: i.config.unique }))).toEqual([
      { name: 'group_students_student_id_idx', unique: false },
    ]);
  });
});
