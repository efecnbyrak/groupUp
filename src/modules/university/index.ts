// university modülünün public API'si — diğer modüller ve app/ yalnızca bunu import eder.
export { candidateDomains, normalizeDomain } from "./domain-match";
export {
  createUniversityRequest,
  getManualAlumniUniversity,
  isValidFacultyDepartment,
  listManualAlumniUniversities,
  listFacultiesWithDepartments,
  resolveEmailDomain,
  type FacultyOption,
  type ResolvedDomain,
} from "./service";
export {
  addDomain,
  assignAdmin,
  createUniversity,
  getUniversity,
  getUniversityRequest,
  listAllAdmins,
  listAllDomains,
  listUniversities,
  listUniversityRequests,
  platformStats,
  rejectUniversityRequest,
  removeAdmin,
  removeDomain,
  setUniversityActive,
  updateUniversity,
  type UniversityErrorCode,
} from "./platform-service";
export {
  adminStats,
  createDepartment,
  createFaculty,
  deleteDepartment,
  deleteFaculty,
  getAdminUniversity,
  isUniversityAdmin,
  listFacultiesForAdmin,
  listPendingAlumni,
  listUniversityUsers,
  revokeAdminRolesForUser,
  updateDepartment,
  updateFaculty,
  USER_PAGE_SIZE,
  type UserListFilter,
} from "./admin-service";
export { requestUniversityAction } from "./actions";
export {
  addDomainAction,
  assignAdminAction,
  createUniversityAction,
  rejectUniversityRequestAction,
  removeAdminAction,
  removeDomainAction,
  setUniversityActiveAction,
  updateUniversityAction,
} from "./platform-actions";
export {
  createDepartmentAction,
  createFacultyAction,
  deleteDepartmentAction,
  deleteFacultyAction,
  updateDepartmentAction,
  updateFacultyAction,
} from "./admin-actions";
export { universityRequestSchema, universitySchema, type UniversityInput, type UniversityRequestInput } from "./schemas";
