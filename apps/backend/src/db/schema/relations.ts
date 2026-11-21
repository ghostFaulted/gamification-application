import { relations } from 'drizzle-orm';
import { courses } from './courses.js';
import { groupStudents } from './group-students.js';
import { groups } from './groups.js';
import { users } from './users.js';

export const usersRelations = relations(users, ({ many }) => ({
  createdCourses: many(courses),
  ledGroups: many(groups),
  groupMemberships: many(groupStudents),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  creator: one(users, {
    fields: [courses.createdBy],
    references: [users.id],
  }),
  groups: many(groups),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  course: one(courses, {
    fields: [groups.courseId],
    references: [courses.id],
  }),
  lecturer: one(users, {
    fields: [groups.lecturerId],
    references: [users.id],
  }),
  students: many(groupStudents),
}));

export const groupStudentsRelations = relations(groupStudents, ({ one }) => ({
  group: one(groups, {
    fields: [groupStudents.groupId],
    references: [groups.id],
  }),
  student: one(users, {
    fields: [groupStudents.studentId],
    references: [users.id],
  }),
}));
