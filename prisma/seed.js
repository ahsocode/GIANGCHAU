import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const roles = [
  { key: "ADMIN", name: "Quản trị", description: "Quản trị hệ thống", isDirector: false },
  { key: "DIRECTOR", name: "Giám đốc", description: "Quản lý cấp cao", isDirector: true },
  { key: "MANAGER", name: "Quản lý", description: "Quản lý phòng ban" },
  { key: "ACCOUNTANT", name: "Kế toán", description: "Quản lý tài chính" },
  { key: "SUPERVISOR", name: "Giám sát", description: "Giám sát sản xuất" },
  { key: "EMPLOYEE", name: "Nhân viên", description: "Nhân viên" },
];

const permissions = [
  { key: "dashboard:view", name: "Xem dashboard" },
  { key: "attendance:view", name: "Xem chấm công" },
  { key: "attendance:edit", name: "Chỉnh sửa chấm công" },
  { key: "employee:view", name: "Xem danh sách nhân sự" },
  { key: "employee:edit", name: "Chỉnh sửa nhân sự" },
  { key: "workconfig:edit", name: "Cấu hình ca làm" },
];

const rolePermissions = {
  ADMIN: permissions.map((p) => p.key),
  DIRECTOR: permissions.map((p) => p.key), // full quyền như admin (trừ quản trị hệ thống nếu muốn tách riêng)
  MANAGER: ["dashboard:view", "attendance:view", "attendance:edit", "employee:view"],
  ACCOUNTANT: ["dashboard:view", "attendance:view", "employee:view"],
  SUPERVISOR: ["attendance:view", "attendance:edit", "employee:view"],
  EMPLOYEE: ["attendance:view"],
};

const defaultPassword = "123456789";
const adminPassword = "DuyHai03082003@";

async function upsertRoles() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: {
        name: role.name,
        description: role.description,
        isDirector: role.isDirector ?? false,
      },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isDirector: role.isDirector ?? false,
      },
    });
  }
}

async function upsertPermissions() {
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, description: perm.description },
      create: { key: perm.key, name: perm.name, description: perm.description },
    });
  }
}

async function upsertRolePermissions() {
  for (const [roleKey, permKeys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) continue;
    const perms = await prisma.permission.findMany({
      where: { key: { in: permKeys } },
    });
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id,
        },
      });
    }
  }
}

function buildAccountPayload(roleKey, fullName, email, password) {
  return {
    employeeCode: null,
    fullName,
    email,
    phone: null,
    roleKey,
    loginType: "PASSWORD",
    password,
    isActive: true,
  };
}

async function upsertAccounts() {
  const accounts = [
    buildAccountPayload("ADMIN", "Admin hệ thống", "admin@giangchau.com", adminPassword),
    buildAccountPayload("DIRECTOR", "Giám đốc", "director@giangchau.com", defaultPassword),
    buildAccountPayload("MANAGER", "Quản lý", "manager@giangchau.com", defaultPassword),
    buildAccountPayload("ACCOUNTANT", "Kế toán", "accountant@giangchau.com", defaultPassword),
    buildAccountPayload("SUPERVISOR", "Giám sát", "supervisor@giangchau.com", defaultPassword),
    buildAccountPayload("EMPLOYEE", "Nhân viên chính thức", "employee@giangchau.com", defaultPassword),
  ];

  for (const acc of accounts) {
    const hashed = await bcrypt.hash(acc.password, 10);
    await prisma.account.upsert({
      where: { email: acc.email },
      update: { ...acc, password: hashed },
      create: { ...acc, password: hashed },
    });
  }
}

async function main() {
  await upsertRoles();
  await upsertPermissions();
  await upsertRolePermissions();
  await upsertAccounts();
}

main()
  .then(() => {
    console.log("Seed completed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
