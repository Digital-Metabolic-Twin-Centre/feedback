
// Site permissions and roles
export const SITE_PERMISSIONS = {
    // view permissions
    CAN_VIEW: "imdhub_view",
    CAN_ACCESS_ECRF: "imdhub_ecrfs",
    CAN_VIEW_PID: "imdhub_view_pid",
    CAN_ACCESS_ADMIN: "imdhub_admin",
    CAN_VIEW_AUDIT_LOGS: "imdhub_audit_logs",
    CAN_ACCESS_LAB_WORKSPACE: "imdhub_labs",
    CAN_ACCESS_LOGISTICS: "imdhub_logistics",
    CAN_ACCESS_ONTOLOGIES: "imdhub_ontologies",
    CAN_VIEW_ACCESS_LOGS: "imdhub_access_logs",
    CAN_ACCESS_PRY_LAB: "imdhub_primary_lab_access",
    CAN_GENERATE_CASE_REPORTS: "imdhub_case_report_form",
    CAN_ACCESS_SUSPECTED_CASES: "imdhub_suspected_cases",
    CAN_ACCESS_ECRF_SECTION: "imdhub_ecrf_section_access",
    CAN_ACCESS_STUDY_SITE_STATUS: "imdhub_study_site_status",
    CAN_ACCESS_UNDIAGNOSED_CASES: "imdhub_undiagnosed_cases_access",

    // create permissions
    CAN_CREATE: "imdhub_create",
    CAN_GENERATE_PID: "imdhub_pid_generator",
    CAN_CREATE_ECRF: "imdhub_ecrfs_create",
    CAN_UPLOAD_SHIPPING_TEMPLATE: "imdhub_upload_shipping_template",
    CAN_CREATE_SUSPECTED_CASES: "imdhub_suspected_cases_create",
    CAN_SET_SYSTEM_SETTINGS: "imdhub_set_system_settings",


    // update permissions
    CAN_UPDATE: "imdhub_update",
    CAN_UPDATE_ECRF: "imdhub_ecrfs_update",
    CAN_UPDATE_SUSPECTED_CASES: "imdhub_suspected_cases_update",

    // trash permissions
    CAN_TRASH: "imdhub_trash",
    CAN_TRASH_ECRF: "imdhub_ecrfs_trash",
    CAN_TRASH_SUSPECTED_CASES: "imdhub_suspected_cases_trash",

    // restore permissions
    CAN_RESTORE: "imdhub_restore",
    CAN_RESTORE_ECRF: "imdhub_ecrfs_restore",
    CAN_RESTORE_SUSPECTED_CASES: "imdhub_suspected_cases_restore",


    // delete permissions
    CAN_DELETE: "imdhub_delete",
    CAN_DELETE_PID: "imdhub_delete_pid",
    CAN_DELETE_ECRF: "imdhub_ecrfs_delete",
    CAN_DELETE_SUSPECTED_CASES: "imdhub_suspected_cases_delete",

    // other permissions
    CAN_COPY_ROW: "imdhub_copy",
    CAN_EXPORT: "imdhub_export",
    CAN_UPLOAD_REF_DATA: "imdhub_ref_data",
    CAN_ACCESS_MAINTENANCE_MODE: "imdhub_maintenance_access",
    CAN_SYNC_GOOGLE_FILES: "imdhub_sync_google_files",
    CAN_ACCESS_WIKI: "imdhub_wiki_access",
    CAN_ACCESS_CONTACTS: "imdhub_contact_access",
    CAN_CONTACTS_ADMIN: "imdhub_contact_admin",
    CAN_SUBMIT_GENOMICS_FEEDBACK: "imdhub_submit_genomics_feedback",

} as const;



export const ADMIN_GROUP_VIEW_PERMISSIONS = "ADMIN_organisation_VIEW"