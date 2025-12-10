import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hashed?: string | null): Promise<boolean> {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
}
