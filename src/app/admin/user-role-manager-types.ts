export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: Date | null;
}

export const ROLES = ["admin", "manager", "member", "viewer"] as const;
export const PAGE_SIZE = 20;

export const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  member: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function getUserName(u: UserData): string | null {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name || null;
}
