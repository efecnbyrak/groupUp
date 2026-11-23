/**
 * Kulüp rolü ve yetki çözümü (ROLES-PERMISSIONS §3) — saf, unit test edilir.
 * Başkan tüm görevli yetkilerine + yalnızca başkana özel işlemlere ("PRESIDENT") sahiptir.
 */
export const STAFF_PERMISSIONS = [
  "EVENT_MANAGE",
  "REGISTRATION_VIEW",
  "REGISTRATION_MANAGE",
  "TOURNAMENT_MANAGE",
  "MEMBER_INVITE",
  "ANNOUNCEMENT_POST",
  "TICKET_OPEN",
] as const;
export type StaffPermissionName = (typeof STAFF_PERMISSIONS)[number];
export type ClubPermission = StaffPermissionName | "PRESIDENT";
export type ClubRole = "PRESIDENT" | "STAFF" | "MEMBER";

/** Başkan + 9 görevli = 10 (ROLES-PERMISSIONS §3). */
export const MAX_STAFF = 9;

export interface ClubAccess {
  role: ClubRole | null;
  permissions: readonly StaffPermissionName[];
  /** Kulübün üniversitesinin Admini veya Süper Admin (doğrudan yetkili, talepsiz). */
  isAdmin: boolean;
}

export function clubRoleOf(input: { isPresident: boolean; staffPermissions: readonly StaffPermissionName[] | null; isActiveMember: boolean }): ClubRole | null {
  if (input.isPresident) return "PRESIDENT";
  if (input.staffPermissions) return "STAFF";
  if (input.isActiveMember) return "MEMBER";
  return null;
}

/** Panel/eylem kontrolü. Admin her kulüp yetkisine sahiptir (doğrudan işlem, audit'li). */
export function hasClubPermission(access: ClubAccess, permission: ClubPermission): boolean {
  if (access.isAdmin) return true;
  if (access.role === "PRESIDENT") return true;
  if (permission === "PRESIDENT") return false;
  return access.role === "STAFF" && access.permissions.includes(permission);
}

/** Kulüp paneline girebilir mi (Başkan veya görevli). */
export function canOpenClubPanel(access: ClubAccess): boolean {
  return access.role === "PRESIDENT" || access.role === "STAFF";
}
