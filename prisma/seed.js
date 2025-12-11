/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, SectionAction } = require("@prisma/client");
const bcrypt = require("bcryptjs");

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

const sections = [
  { key: "overview", label: "Tổng quan", path: "tong-quan", group: "core", sortOrder: 1, actions: [SectionAction.VIEW] },
  { key: "departments", label: "Quản lý bộ phận", path: "quan-ly-bo-phan", group: "core", sortOrder: 2, actions: [SectionAction.VIEW, SectionAction.CREATE, SectionAction.UPDATE, SectionAction.DELETE] },
  { key: "employeesOverview", label: "Tổng quan nhân viên", path: "quan-ly-nhan-vien/tong-quan-nhan-vien", group: "nhan-su", sortOrder: 3, actions: [SectionAction.VIEW] },
  { key: "employees", label: "Danh sách nhân viên", path: "quan-ly-nhan-vien/danh-sach-nhan-vien", group: "nhan-su", sortOrder: 4, actions: [SectionAction.VIEW, SectionAction.CREATE, SectionAction.UPDATE, SectionAction.DELETE] },
  { key: "employeeInfo", label: "Thông tin nhân viên", path: "quan-ly-nhan-vien/thong-tin-nhan-vien", group: "nhan-su", sortOrder: 5, actions: [SectionAction.VIEW, SectionAction.UPDATE] },
  { key: "employeeAccounts", label: "Quản lý tài khoản", path: "quan-ly-nhan-vien/quan-ly-tai-khoan", group: "nhan-su", sortOrder: 6, actions: [SectionAction.VIEW, SectionAction.UPDATE] },
  { key: "attendance", label: "Quản lý chấm công", path: "quan-ly-cham-cong", group: "cham-cong", sortOrder: 7, actions: [SectionAction.VIEW, SectionAction.UPDATE] },
  { key: "shiftOverview", label: "Tổng quan ca làm", path: "quan-ly-ca-lam/tong-quan-ca-lam", group: "cham-cong", sortOrder: 8, actions: [SectionAction.VIEW] },
  { key: "shifts", label: "Ca làm", path: "quan-ly-ca-lam/ca-lam", group: "cham-cong", sortOrder: 9, actions: [SectionAction.VIEW, SectionAction.CREATE, SectionAction.UPDATE, SectionAction.DELETE] },
  { key: "shiftAssignment", label: "Phân ca", path: "quan-ly-ca-lam/phan-ca", group: "cham-cong", sortOrder: 10, actions: [SectionAction.VIEW, SectionAction.UPDATE] },
  { key: "permissions", label: "Phân quyền", path: "quan-ly-chuc-vu/phan-quyen", group: "he-thong", sortOrder: 11, actions: [SectionAction.VIEW, SectionAction.MANAGE] },
  { key: "roles", label: "Chức vụ", path: "quan-ly-chuc-vu/chuc-vu", group: "he-thong", sortOrder: 12, actions: [SectionAction.VIEW, SectionAction.CREATE, SectionAction.UPDATE, SectionAction.DELETE] },
];

const roleSectionAccess = {
  // Admin/Director luôn full quyền (không cần lưu ở đây).
  // Các role khác mặc định không có section nào; Admin/Director sẽ tự cấu hình.
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

async function upsertSections() {
  for (const section of sections) {
    await prisma.appSection.upsert({
      where: { key: section.key },
      update: {
        label: section.label,
        path: section.path,
        group: section.group,
        sortOrder: section.sortOrder,
        isEnabled: true,
        actions: section.actions,
      },
      create: {
        key: section.key,
        label: section.label,
        path: section.path,
        group: section.group,
        sortOrder: section.sortOrder,
        isEnabled: true,
        actions: section.actions,
      },
    });
  }
}

async function upsertRoleSectionAccess() {
  const sectionMap = new Map();
  for (const s of sections) {
    const existing = await prisma.appSection.findUnique({ where: { key: s.key } });
    if (existing) sectionMap.set(s.key, existing);
  }

  for (const [roleKey, sectionKeys] of Object.entries(roleSectionAccess)) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) continue;

    for (const key of sectionKeys) {
      const section = sectionMap.get(key);
      if (!section) continue;
      await prisma.roleSectionAccess.upsert({
        where: {
          roleId_sectionId: {
            roleId: role.id,
            sectionId: section.id,
          },
        },
        update: {
          allowedActions: section.actions?.length ? section.actions : [SectionAction.VIEW],
        },
        create: {
          roleId: role.id,
          sectionId: section.id,
          allowedActions: section.actions?.length ? section.actions : [SectionAction.VIEW],
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

async function ensureAccountDetails() {
  const accounts = await prisma.account.findMany({ select: { id: true } });
  for (const acc of accounts) {
    await prisma.accountDetail.upsert({
      where: { accountId: acc.id },
      update: {},
      create: { accountId: acc.id },
    });
  }
}

async function main() {
  await upsertRoles();
  await upsertPermissions();
  await upsertRolePermissions();
  await upsertSections();
  await upsertRoleSectionAccess();
  await upsertAccounts();
  await ensureAccountDetails();
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
