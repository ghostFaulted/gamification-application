import { relations } from 'drizzle-orm';
import { courses } from './courses.js';
import { groupStudents } from './group-students.js';
import { groups } from './groups.js';
import { pointTransactions } from './point-transactions.js';
import { users } from './users.js';

export const usersRelations = relations(users, ({ many }) => ({
  createdCourses: many(courses),
  ledGroups: many(groups),
  groupMemberships: many(groupStudents),
  receivedPointTransactions: many(pointTransactions, {
    relationName: 'studentPointTransactions',
  }),
  awardedPointTransactions: many(pointTransactions, {
    relationName: 'awardedByPointTransactions',
  }),
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
  pointTransactions: many(pointTransactions),
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

export const pointTransactionsRelations = relations(pointTransactions, ({ one }) => ({
  group: one(groups, {
    fields: [pointTransactions.groupId],
    references: [groups.id],
  }),
  student: one(users, {
    fields: [pointTransactions.studentId],
    references: [users.id],
    relationName: 'studentPointTransactions',
  }),
  awardedByUser: one(users, {
    fields: [pointTransactions.awardedBy],
    references: [users.id],
    relationName: 'awardedByPointTransactions',
  }),
}));
