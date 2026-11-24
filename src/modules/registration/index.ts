// registration modülünün public API'si (ARCHITECTURE §4: event, club, profile bağımlıdır;
// event/club/approval bu modülü import ETMEZ — bağımlılık yönü tek taraflı).
export {
  applyFormTemplateAction,
  applyToEventAction,
  cancelRegistrationAction,
  completeTeamAction,
  createFormFieldAction,
  createTeamAction,
  decideManyRegistrationsAction,
  decideManyTeamsAction,
  decideRegistrationAction,
  decideTeamAction,
  deleteFormFieldAction,
  disbandTeamAction,
  joinTeamAction,
  leaveTeamAction,
  removeTeamMemberAction,
  reorderFormFieldAction,
  toggleFormFieldAction,
  transferCaptainAction,
  updateFormFieldAction,
  updateMyAnswersAction,
  uploadRegistrationFileAction,
} from "./actions";
export { buildExportRows, toCsv, toXlsx } from "./export";
export { REGISTRATION_ERROR_KEYS } from "./errors";
export { applyTemplate, createField, deleteField, listFields, listVisibleFields, reorderField, toFieldDef, toggleFieldHidden, updateField, type FieldInput } from "./fields";
export {
  countAccepted,
  getMyRegistration,
  listFieldsPublic,
  listMyRegistrations,
  listRegistrationsForManage,
  listTeamsForManage,
} from "./queries";
export { applyToEvent, cancelRegistration, decideManyRegistrations, decideRegistration, SNAPSHOT_COLUMNS, snapshotProfile, updateMyAnswers } from "./registrations";
export {
  CHOICE_TYPES,
  decideCapacity,
  FILE_ACCEPT,
  FORM_FIELD_TYPES,
  isFieldVisible,
  LABEL_MAX,
  OPTION_LABEL_MAX,
  OPTION_MAX,
  TEAM_NAME_MAX,
  teamSizeProblem,
  canCompleteTeam,
  validateAnswers,
  type FieldConfig,
  type FieldDef,
  type FieldOption,
  type FormFieldType,
} from "./rules";
export {
  applySchema,
  applyTemplateSchema,
  decideManySchema,
  decideSchema,
  formFieldSchema,
  formFieldUpdateSchema,
  registrationIdSchema,
  teamCreateSchema,
  teamIdSchema,
  teamJoinSchema,
  teamMemberRemoveSchema,
  teamTransferSchema,
  uploadRegistrationFileSchema,
} from "./schemas";
export { fail as registrationError } from "./service";
export { FORM_TEMPLATES, findTemplate } from "./templates";
export {
  completeTeam,
  createTeam,
  decideManyTeams,
  decideTeam,
  disbandTeam,
  getMyTeam,
  getTeamByCode,
  joinTeam,
  leaveTeam,
  removeTeamMember,
  transferCaptain,
} from "./teams";
export { registrationFileUrl, storeRegistrationFile } from "./files";
export { sendDeadlineReminders, sendEventReminders } from "./reminders";
export { RegistrationManageTable, type ManageRow, type ManageTableLabels } from "./components/manage-table";
export { DynamicField, type DynamicFieldLabels } from "./components/dynamic-field";
export { EventRegistrationPanel, type EventPanelLabels, type MyRegistration, type MyTeam } from "./components/event-panel";
