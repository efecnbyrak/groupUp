import { describe, expect, it } from "vitest";

import { canOpenClubPanel, clubRoleOf, hasClubPermission, type ClubAccess } from "./club-roles";

const access = (o: Partial<ClubAccess>): ClubAccess => ({ role: null, permissions: [], isAdmin: false, ...o });

describe("club-roles", () => {
  it("rol önceliği: başkan > görevli > üye", () => {
    expect(clubRoleOf({ isPresident: true, staffPermissions: ["EVENT_MANAGE"], isActiveMember: true })).toBe("PRESIDENT");
    expect(clubRoleOf({ isPresident: false, staffPermissions: [], isActiveMember: true })).toBe("STAFF");
    expect(clubRoleOf({ isPresident: false, staffPermissions: null, isActiveMember: true })).toBe("MEMBER");
    expect(clubRoleOf({ isPresident: false, staffPermissions: null, isActiveMember: false })).toBeNull();
  });

  it("başkan her şeye yetkili", () => {
    expect(hasClubPermission(access({ role: "PRESIDENT" }), "PRESIDENT")).toBe(true);
    expect(hasClubPermission(access({ role: "PRESIDENT" }), "MEMBER_INVITE")).toBe(true);
  });

  it("görevli yalnızca işaretli yetkiler, başkana özel işlem yok", () => {
    const staff = access({ role: "STAFF", permissions: ["MEMBER_INVITE"] });
    expect(hasClubPermission(staff, "MEMBER_INVITE")).toBe(true);
    expect(hasClubPermission(staff, "TICKET_OPEN")).toBe(false);
    expect(hasClubPermission(staff, "PRESIDENT")).toBe(false);
  });

  it("üye ve yabancı yetkisiz; Admin yetkili", () => {
    expect(hasClubPermission(access({ role: "MEMBER" }), "MEMBER_INVITE")).toBe(false);
    expect(hasClubPermission(access({}), "TICKET_OPEN")).toBe(false);
    expect(hasClubPermission(access({ isAdmin: true }), "PRESIDENT")).toBe(true);
  });

  it("panel: yalnızca başkan ve görevli", () => {
    expect(canOpenClubPanel(access({ role: "PRESIDENT" }))).toBe(true);
    expect(canOpenClubPanel(access({ role: "STAFF" }))).toBe(true);
    expect(canOpenClubPanel(access({ role: "MEMBER" }))).toBe(false);
    expect(canOpenClubPanel(access({ isAdmin: true }))).toBe(false);
  });
});
