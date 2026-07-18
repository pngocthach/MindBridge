export const userRoles = ["learner", "teacher", "editor", "admin"] as const;

export type UserRole = (typeof userRoles)[number];

export const permissions = [
	"learning:read",
	"learning:attempt",
	"class:read",
	"assignment:create",
	"source:upload",
	"content:read",
	"content:create",
	"content:update",
	"content:submit-review",
	"content:review",
	"content:publish",
	"content:archive",
	"users:manage",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<
	Exclude<UserRole, "admin">,
	readonly Permission[]
> = {
	learner: ["learning:read", "learning:attempt"],
	teacher: [
		"learning:read",
		"class:read",
		"assignment:create",
		"source:upload",
		"content:create",
	],
	editor: [
		"source:upload",
		"content:read",
		"content:create",
		"content:update",
		"content:submit-review",
	],
};

export const isUserRole = (value: unknown): value is UserRole =>
	typeof value === "string" && userRoles.includes(value as UserRole);

export const hasPermission = (
	role: UserRole,
	permission: Permission,
): boolean => role === "admin" || rolePermissions[role].includes(permission);
