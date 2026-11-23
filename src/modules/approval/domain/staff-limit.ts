import { type RequestStatus } from "./state-machine";

/**
 * Ekip sınırı (ROLES-PERMISSIONS §3): Başkan + 9 görevli. Bekleyen STAFF_ASSIGN talepleri
 * (mevcut görevlinin güncellemesi hariç) yer ayırır. Saf TS.
 */
export function staffSlotsUsed(currentStaffUserIds: readonly string[], pendingAssignTargets: readonly string[]): number {
  const staff = new Set(currentStaffUserIds);
  const pendingNew = new Set(pendingAssignTargets.filter((id) => !staff.has(id)));
  return staff.size + pendingNew.size;
}

/** `userId` eklendiğinde sınır aşılır mı? Zaten görevliyse (güncelleme) veya zaten bekliyorsa yer tutmaz. */
export function wouldExceedStaffLimit(
  userId: string,
  currentStaffUserIds: readonly string[],
  pendingAssignTargets: readonly string[],
  max: number,
): boolean {
  if (currentStaffUserIds.includes(userId) || pendingAssignTargets.includes(userId)) return staffSlotsUsed(currentStaffUserIds, pendingAssignTargets) > max;
  return staffSlotsUsed(currentStaffUserIds, pendingAssignTargets) + 1 > max;
}

export type { RequestStatus };
