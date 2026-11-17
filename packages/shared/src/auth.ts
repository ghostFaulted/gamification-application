import type { Role } from './roles.js';

export interface LoginRequest {
  login: string;
  password: string;
}

export interface AuthUser {
  login: string;
  role: Role;
}

export interface LoginResponse {
  user: AuthUser;
}
