// university modülünün public API'si — diğer modüller ve app/ yalnızca bunu import eder.
export { candidateDomains } from "./domain-match";
export {
  createUniversityRequest,
  isValidFacultyDepartment,
  listFacultiesWithDepartments,
  resolveEmailDomain,
  type FacultyOption,
  type ResolvedDomain,
} from "./service";
export { requestUniversityAction } from "./actions";
export { universityRequestSchema, type UniversityRequestInput } from "./schemas";
