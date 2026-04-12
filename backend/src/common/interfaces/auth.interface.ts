export interface AuthUser {
  id: number;
  email: string;
  role: string;
  companyId: number;
}

export interface AuthRequest {
  user: AuthUser;
}
