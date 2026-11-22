export interface CourseDto {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCourseRequest {
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface GroupDto {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string | null;
  lecturerId: string;
  lecturerLogin: string;
  name: string;
  semester: string | null;
  description: string | null;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupRequest {
  courseId: string;
  name: string;
  semester?: string | null;
  description?: string | null;
  /** Allowed only for admins; lecturers are always assigned as the owner. */
  lecturerId?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  semester?: string | null;
  description?: string | null;
}
