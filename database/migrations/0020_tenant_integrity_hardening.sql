-- SaaS tenant integrity hardening.
-- Every tenant-scoped child relation must reference the parent together with tenant_id.
-- This prevents accidental cross-tenant joins even when UUIDs are known or leaked.

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_tenant_role ON roles(tenant_id, role_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_user ON users(tenant_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_tenant_client ON clients(tenant_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estimates_tenant_estimate ON estimates(tenant_id, estimate_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_tenant_job ON jobs(tenant_id, job_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workers_tenant_worker ON workers(tenant_id, worker_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_time_entries_tenant_time_entry ON time_entries(tenant_id, time_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_reports_tenant_field_report ON field_reports(tenant_id, field_report_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_tenant_document ON documents(tenant_id, document_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_tenant_invoice ON invoices(tenant_id, invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_tenant_expense ON expenses(tenant_id, expense_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_tenant_asset ON assets(tenant_id, asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_liabilities_tenant_liability ON liabilities(tenant_id, liability_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_storage_objects_tenant_storage_object ON storage_objects(tenant_id, storage_object_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_phases_tenant_job_phase ON job_phases(tenant_id, job_phase_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estimate_versions_tenant_estimate_version ON estimate_versions(tenant_id, estimate_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estimate_sections_tenant_estimate_section ON estimate_sections(tenant_id, estimate_section_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_accounts_tenant_account ON financial_accounts(tenant_id, financial_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_tenant_vendor ON vendors(tenant_id, vendor_id);

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE user_roles
SET tenant_id = users.tenant_id
FROM users
WHERE user_roles.user_id = users.user_id
  AND user_roles.tenant_id IS NULL;

ALTER TABLE user_roles ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id, user_id, role_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_roles_tenant_user') THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT fk_user_roles_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_roles_tenant_role') THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT fk_user_roles_tenant_role
      FOREIGN KEY (tenant_id, role_id) REFERENCES roles(tenant_id, role_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_credentials_tenant_user') THEN
    ALTER TABLE auth_password_credentials
      ADD CONSTRAINT fk_auth_credentials_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_invitations_invited_by_tenant_user') THEN
    ALTER TABLE auth_invitations
      ADD CONSTRAINT fk_auth_invitations_invited_by_tenant_user
      FOREIGN KEY (tenant_id, invited_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_invitations_accepted_by_tenant_user') THEN
    ALTER TABLE auth_invitations
      ADD CONSTRAINT fk_auth_invitations_accepted_by_tenant_user
      FOREIGN KEY (tenant_id, accepted_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_sessions_tenant_user') THEN
    ALTER TABLE auth_sessions
      ADD CONSTRAINT fk_auth_sessions_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_workers_tenant_user') THEN
    ALTER TABLE workers
      ADD CONSTRAINT fk_workers_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estimates_tenant_client') THEN
    ALTER TABLE estimates
      ADD CONSTRAINT fk_estimates_tenant_client
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_jobs_tenant_client') THEN
    ALTER TABLE jobs
      ADD CONSTRAINT fk_jobs_tenant_client
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_jobs_tenant_estimate') THEN
    ALTER TABLE jobs
      ADD CONSTRAINT fk_jobs_tenant_estimate
      FOREIGN KEY (tenant_id, estimate_id) REFERENCES estimates(tenant_id, estimate_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignments_tenant_job') THEN
    ALTER TABLE assignments
      ADD CONSTRAINT fk_assignments_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignments_tenant_worker') THEN
    ALTER TABLE assignments
      ADD CONSTRAINT fk_assignments_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_time_entries_tenant_worker') THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT fk_time_entries_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_time_entries_tenant_job') THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT fk_time_entries_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_reports_tenant_job') THEN
    ALTER TABLE field_reports
      ADD CONSTRAINT fk_field_reports_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_reports_tenant_created_by') THEN
    ALTER TABLE field_reports
      ADD CONSTRAINT fk_field_reports_tenant_created_by
      FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_tenant_client') THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_tenant_client
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_tenant_job') THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_tenant_job') THEN
    ALTER TABLE expenses
      ADD CONSTRAINT fk_expenses_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_events_tenant_actor') THEN
    ALTER TABLE audit_events
      ADD CONSTRAINT fk_audit_events_tenant_actor
      FOREIGN KEY (tenant_id, actor_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_tenant_storage_object') THEN
    ALTER TABLE documents
      ADD CONSTRAINT fk_documents_tenant_storage_object
      FOREIGN KEY (tenant_id, storage_object_id) REFERENCES storage_objects(tenant_id, storage_object_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_storage_objects_tenant_created_by') THEN
    ALTER TABLE storage_objects
      ADD CONSTRAINT fk_storage_objects_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_storage_versions_tenant_storage_object') THEN
    ALTER TABLE storage_object_versions
      ADD CONSTRAINT fk_storage_versions_tenant_storage_object
      FOREIGN KEY (tenant_id, storage_object_id) REFERENCES storage_objects(tenant_id, storage_object_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_storage_access_tenant_storage_object') THEN
    ALTER TABLE storage_access_events
      ADD CONSTRAINT fk_storage_access_tenant_storage_object
      FOREIGN KEY (tenant_id, storage_object_id) REFERENCES storage_objects(tenant_id, storage_object_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_contacts_tenant_client') THEN
    ALTER TABLE client_contacts
      ADD CONSTRAINT fk_client_contacts_tenant_client
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, client_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_activities_tenant_client') THEN
    ALTER TABLE client_activities
      ADD CONSTRAINT fk_client_activities_tenant_client
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, client_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_notes_tenant_client') THEN
    ALTER TABLE client_notes
      ADD CONSTRAINT fk_client_notes_tenant_client
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, client_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estimate_versions_tenant_estimate') THEN
    ALTER TABLE estimate_versions
      ADD CONSTRAINT fk_estimate_versions_tenant_estimate
      FOREIGN KEY (tenant_id, estimate_id) REFERENCES estimates(tenant_id, estimate_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estimate_sections_tenant_estimate_version') THEN
    ALTER TABLE estimate_sections
      ADD CONSTRAINT fk_estimate_sections_tenant_estimate_version
      FOREIGN KEY (tenant_id, estimate_version_id) REFERENCES estimate_versions(tenant_id, estimate_version_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estimate_items_tenant_estimate_section') THEN
    ALTER TABLE estimate_items
      ADD CONSTRAINT fk_estimate_items_tenant_estimate_section
      FOREIGN KEY (tenant_id, estimate_section_id) REFERENCES estimate_sections(tenant_id, estimate_section_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_phases_tenant_job') THEN
    ALTER TABLE job_phases
      ADD CONSTRAINT fk_job_phases_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_tasks_tenant_job') THEN
    ALTER TABLE job_tasks
      ADD CONSTRAINT fk_job_tasks_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_tasks_tenant_job_phase') THEN
    ALTER TABLE job_tasks
      ADD CONSTRAINT fk_job_tasks_tenant_job_phase
      FOREIGN KEY (tenant_id, job_phase_id) REFERENCES job_phases(tenant_id, job_phase_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_tasks_tenant_worker') THEN
    ALTER TABLE job_tasks
      ADD CONSTRAINT fk_job_tasks_tenant_worker
      FOREIGN KEY (tenant_id, assigned_to_worker_id) REFERENCES workers(tenant_id, worker_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_change_requests_tenant_job') THEN
    ALTER TABLE job_change_requests
      ADD CONSTRAINT fk_job_change_requests_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_incidents_tenant_job') THEN
    ALTER TABLE job_incidents
      ADD CONSTRAINT fk_job_incidents_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_worker_profiles_tenant_worker') THEN
    ALTER TABLE worker_profiles
      ADD CONSTRAINT fk_worker_profiles_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_worker_availability_tenant_worker') THEN
    ALTER TABLE worker_availability
      ADD CONSTRAINT fk_worker_availability_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_worker_certifications_tenant_worker') THEN
    ALTER TABLE worker_certifications
      ADD CONSTRAINT fk_worker_certifications_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_break_entries_tenant_time_entry') THEN
    ALTER TABLE break_entries
      ADD CONSTRAINT fk_break_entries_tenant_time_entry
      FOREIGN KEY (tenant_id, time_entry_id) REFERENCES time_entries(tenant_id, time_entry_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_approvals_tenant_time_entry') THEN
    ALTER TABLE attendance_approvals
      ADD CONSTRAINT fk_attendance_approvals_tenant_time_entry
      FOREIGN KEY (tenant_id, time_entry_id) REFERENCES time_entries(tenant_id, time_entry_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_exceptions_tenant_worker') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT fk_attendance_exceptions_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_proofs_tenant_field_report') THEN
    ALTER TABLE work_proofs
      ADD CONSTRAINT fk_work_proofs_tenant_field_report
      FOREIGN KEY (tenant_id, field_report_id) REFERENCES field_reports(tenant_id, field_report_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_proofs_tenant_storage_object') THEN
    ALTER TABLE work_proofs
      ADD CONSTRAINT fk_work_proofs_tenant_storage_object
      FOREIGN KEY (tenant_id, storage_object_id) REFERENCES storage_objects(tenant_id, storage_object_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_checklist_tenant_field_report') THEN
    ALTER TABLE field_report_checklist_items
      ADD CONSTRAINT fk_field_checklist_tenant_field_report
      FOREIGN KEY (tenant_id, field_report_id) REFERENCES field_reports(tenant_id, field_report_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_materials_tenant_field_report') THEN
    ALTER TABLE field_report_materials
      ADD CONSTRAINT fk_field_materials_tenant_field_report
      FOREIGN KEY (tenant_id, field_report_id) REFERENCES field_reports(tenant_id, field_report_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_versions_tenant_document') THEN
    ALTER TABLE document_versions
      ADD CONSTRAINT fk_document_versions_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_versions_tenant_storage_object') THEN
    ALTER TABLE document_versions
      ADD CONSTRAINT fk_document_versions_tenant_storage_object
      FOREIGN KEY (tenant_id, storage_object_id) REFERENCES storage_objects(tenant_id, storage_object_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_links_tenant_document') THEN
    ALTER TABLE document_links
      ADD CONSTRAINT fk_document_links_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_permissions_tenant_document') THEN
    ALTER TABLE document_permissions
      ADD CONSTRAINT fk_document_permissions_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_expiration_tenant_document') THEN
    ALTER TABLE document_expiration_events
      ADD CONSTRAINT fk_document_expiration_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_items_tenant_invoice') THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT fk_invoice_items_tenant_invoice
      FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, invoice_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_tenant_invoice') THEN
    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_tenant_invoice
      FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, invoice_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_receipts_tenant_document') THEN
    ALTER TABLE receipts
      ADD CONSTRAINT fk_receipts_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_status_history_tenant_invoice') THEN
    ALTER TABLE invoice_status_history
      ADD CONSTRAINT fk_invoice_status_history_tenant_invoice
      FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, invoice_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_tenant_vendor') THEN
    ALTER TABLE expenses
      ADD CONSTRAINT fk_expenses_tenant_vendor
      FOREIGN KEY (tenant_id, vendor_id) REFERENCES vendors(tenant_id, vendor_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expense_items_tenant_expense') THEN
    ALTER TABLE expense_items
      ADD CONSTRAINT fk_expense_items_tenant_expense
      FOREIGN KEY (tenant_id, expense_id) REFERENCES expenses(tenant_id, expense_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expense_payments_tenant_expense') THEN
    ALTER TABLE expense_payments
      ADD CONSTRAINT fk_expense_payments_tenant_expense
      FOREIGN KEY (tenant_id, expense_id) REFERENCES expenses(tenant_id, expense_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_transactions_tenant_account') THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT fk_financial_transactions_tenant_account
      FOREIGN KEY (tenant_id, financial_account_id) REFERENCES financial_accounts(tenant_id, financial_account_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_reconciliations_tenant_account') THEN
    ALTER TABLE financial_reconciliations
      ADD CONSTRAINT fk_financial_reconciliations_tenant_account
      FOREIGN KEY (tenant_id, financial_account_id) REFERENCES financial_accounts(tenant_id, financial_account_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_profitability_tenant_job') THEN
    ALTER TABLE job_profitability_snapshots
      ADD CONSTRAINT fk_job_profitability_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asset_maintenance_tenant_asset') THEN
    ALTER TABLE asset_maintenance
      ADD CONSTRAINT fk_asset_maintenance_tenant_asset
      FOREIGN KEY (tenant_id, asset_id) REFERENCES assets(tenant_id, asset_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asset_maintenance_tenant_vendor') THEN
    ALTER TABLE asset_maintenance
      ADD CONSTRAINT fk_asset_maintenance_tenant_vendor
      FOREIGN KEY (tenant_id, vendor_id) REFERENCES vendors(tenant_id, vendor_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asset_depreciation_tenant_asset') THEN
    ALTER TABLE asset_depreciation_entries
      ADD CONSTRAINT fk_asset_depreciation_tenant_asset
      FOREIGN KEY (tenant_id, asset_id) REFERENCES assets(tenant_id, asset_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_liability_schedule_tenant_liability') THEN
    ALTER TABLE liability_payment_schedule
      ADD CONSTRAINT fk_liability_schedule_tenant_liability
      FOREIGN KEY (tenant_id, liability_id) REFERENCES liabilities(tenant_id, liability_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_liability_documents_tenant_liability') THEN
    ALTER TABLE liability_documents
      ADD CONSTRAINT fk_liability_documents_tenant_liability
      FOREIGN KEY (tenant_id, liability_id) REFERENCES liabilities(tenant_id, liability_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_liability_documents_tenant_document') THEN
    ALTER TABLE liability_documents
      ADD CONSTRAINT fk_liability_documents_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_marketing_campaigns_tenant_created_by') THEN
    ALTER TABLE marketing_campaigns
      ADD CONSTRAINT fk_marketing_campaigns_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_marketing_leads_tenant_converted_client') THEN
    ALTER TABLE marketing_leads
      ADD CONSTRAINT fk_marketing_leads_tenant_converted_client
      FOREIGN KEY (tenant_id, converted_client_id) REFERENCES clients(tenant_id, client_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_marketing_followups_tenant_assigned_to') THEN
    ALTER TABLE marketing_followups
      ADD CONSTRAINT fk_marketing_followups_tenant_assigned_to
      FOREIGN KEY (tenant_id, assigned_to_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_marketing_reviews_tenant_client') THEN
    ALTER TABLE marketing_reviews
      ADD CONSTRAINT fk_marketing_reviews_tenant_client
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, client_id);
  END IF;
END $$;
