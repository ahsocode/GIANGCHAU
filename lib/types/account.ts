export type UserRole = string;

export interface Account {
  id: string;
  employeeCode: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  loginType: "PASSWORD" | "GOOGLE";
  isActive: boolean;
  createdAt: string;
  password?: string | null;
}
