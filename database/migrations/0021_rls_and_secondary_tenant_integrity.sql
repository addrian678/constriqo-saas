-- Completes tenant integrity for secondary references and enables PostgreSQL RLS.
-- App connections must set: SELECT set_config('app.tenant_id', '<tenant-uuid>', true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_campaigns_tenant_campaign ON marketing_campaigns(tenant_id, marketing_campaign_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_tasks_tenant_job_phase') THEN
    ALTER TABLE job_tasks DROP CONSTRAINT fk_job_tasks_tenant_job_phase;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_tasks_tenant_job_phase_restrict') THEN
    ALTER TABLE job_tasks
      ADD CONSTRAINT fk_job_tasks_tenant_job_phase_restrict
      FOREIGN KEY (tenant_id, job_phase_id) REFERENCES job_phases(tenant_id, job_phase_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'clear_job_phase_on_delete') THEN
    CREATE FUNCTION clear_job_phase_on_delete()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      UPDATE job_tasks
      SET job_phase_id = NULL
      WHERE tenant_id = OLD.tenant_id
        AND job_phase_id = OLD.job_phase_id;
      RETURN OLD;
    END;
    $fn$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clear_job_phase_on_delete') THEN
    CREATE TRIGGER trg_clear_job_phase_on_delete
      BEFORE DELETE ON job_phases
      FOR EACH ROW
      EXECUTE FUNCTION clear_job_phase_on_delete();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'clear_marketing_campaign_on_delete') THEN
    CREATE FUNCTION clear_marketing_campaign_on_delete()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      UPDATE marketing_leads
      SET marketing_campaign_id = NULL
      WHERE tenant_id = OLD.tenant_id
        AND marketing_campaign_id = OLD.marketing_campaign_id;
      RETURN OLD;
    END;
    $fn$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clear_marketing_campaign_on_delete') THEN
    CREATE TRIGGER trg_clear_marketing_campaign_on_delete
      BEFORE DELETE ON marketing_campaigns
      FOR EACH ROW
      EXECUTE FUNCTION clear_marketing_campaign_on_delete();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_storage_versions_tenant_created_by') THEN
    ALTER TABLE storage_object_versions
      ADD CONSTRAINT fk_storage_versions_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_storage_access_tenant_actor') THEN
    ALTER TABLE storage_access_events
      ADD CONSTRAINT fk_storage_access_tenant_actor
      FOREIGN KEY (tenant_id, actor_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_activities_tenant_assigned_to') THEN
    ALTER TABLE client_activities
      ADD CONSTRAINT fk_client_activities_tenant_assigned_to
      FOREIGN KEY (tenant_id, assigned_to_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_activities_tenant_created_by') THEN
    ALTER TABLE client_activities
      ADD CONSTRAINT fk_client_activities_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_notes_tenant_created_by') THEN
    ALTER TABLE client_notes
      ADD CONSTRAINT fk_client_notes_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estimate_versions_tenant_created_by') THEN
    ALTER TABLE estimate_versions
      ADD CONSTRAINT fk_estimate_versions_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estimate_approvals_tenant_approved_by') THEN
    ALTER TABLE estimate_approvals
      ADD CONSTRAINT fk_estimate_approvals_tenant_approved_by
      FOREIGN KEY (tenant_id, approved_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_tasks_tenant_created_by') THEN
    ALTER TABLE job_tasks
      ADD CONSTRAINT fk_job_tasks_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_change_requests_tenant_requested_by') THEN
    ALTER TABLE job_change_requests
      ADD CONSTRAINT fk_job_change_requests_tenant_requested_by
      FOREIGN KEY (tenant_id, requested_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_change_requests_tenant_approved_by') THEN
    ALTER TABLE job_change_requests
      ADD CONSTRAINT fk_job_change_requests_tenant_approved_by
      FOREIGN KEY (tenant_id, approved_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_incidents_tenant_reported_by') THEN
    ALTER TABLE job_incidents
      ADD CONSTRAINT fk_job_incidents_tenant_reported_by
      FOREIGN KEY (tenant_id, reported_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_incidents_tenant_field_report') THEN
    ALTER TABLE job_incidents
      ADD CONSTRAINT fk_job_incidents_tenant_field_report
      FOREIGN KEY (tenant_id, field_report_id) REFERENCES field_reports(tenant_id, field_report_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_worker_certifications_tenant_document') THEN
    ALTER TABLE worker_certifications
      ADD CONSTRAINT fk_worker_certifications_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_approvals_tenant_reviewed_by') THEN
    ALTER TABLE attendance_approvals
      ADD CONSTRAINT fk_attendance_approvals_tenant_reviewed_by
      FOREIGN KEY (tenant_id, reviewed_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_exceptions_tenant_time_entry') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT fk_attendance_exceptions_tenant_time_entry
      FOREIGN KEY (tenant_id, time_entry_id) REFERENCES time_entries(tenant_id, time_entry_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_exceptions_tenant_reviewed_by') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT fk_attendance_exceptions_tenant_reviewed_by
      FOREIGN KEY (tenant_id, reviewed_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_proofs_tenant_created_by') THEN
    ALTER TABLE work_proofs
      ADD CONSTRAINT fk_work_proofs_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_proofs_tenant_reviewed_by') THEN
    ALTER TABLE work_proofs
      ADD CONSTRAINT fk_work_proofs_tenant_reviewed_by
      FOREIGN KEY (tenant_id, reviewed_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_versions_tenant_created_by') THEN
    ALTER TABLE document_versions
      ADD CONSTRAINT fk_document_versions_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_permissions_tenant_role') THEN
    ALTER TABLE document_permissions
      ADD CONSTRAINT fk_document_permissions_tenant_role
      FOREIGN KEY (tenant_id, role_id) REFERENCES roles(tenant_id, role_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_permissions_tenant_user') THEN
    ALTER TABLE document_permissions
      ADD CONSTRAINT fk_document_permissions_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_tenant_recorded_by') THEN
    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_tenant_recorded_by
      FOREIGN KEY (tenant_id, recorded_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_status_history_tenant_changed_by') THEN
    ALTER TABLE invoice_status_history
      ADD CONSTRAINT fk_invoice_status_history_tenant_changed_by
      FOREIGN KEY (tenant_id, changed_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_tenant_approved_by') THEN
    ALTER TABLE expenses
      ADD CONSTRAINT fk_expenses_tenant_approved_by
      FOREIGN KEY (tenant_id, approved_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expense_payments_tenant_recorded_by') THEN
    ALTER TABLE expense_payments
      ADD CONSTRAINT fk_expense_payments_tenant_recorded_by
      FOREIGN KEY (tenant_id, recorded_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expense_status_history_tenant_changed_by') THEN
    ALTER TABLE expense_status_history
      ADD CONSTRAINT fk_expense_status_history_tenant_changed_by
      FOREIGN KEY (tenant_id, changed_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_transactions_tenant_created_by') THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT fk_financial_transactions_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_reconciliations_tenant_reviewed_by') THEN
    ALTER TABLE financial_reconciliations
      ADD CONSTRAINT fk_financial_reconciliations_tenant_reviewed_by
      FOREIGN KEY (tenant_id, reviewed_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asset_depreciation_tenant_created_by') THEN
    ALTER TABLE asset_depreciation_entries
      ADD CONSTRAINT fk_asset_depreciation_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organization_settings_tenant_updated_by') THEN
    ALTER TABLE organization_settings
      ADD CONSTRAINT fk_organization_settings_tenant_updated_by
      FOREIGN KEY (tenant_id, updated_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenant_feature_flags_tenant_updated_by') THEN
    ALTER TABLE tenant_feature_flags
      ADD CONSTRAINT fk_tenant_feature_flags_tenant_updated_by
      FOREIGN KEY (tenant_id, updated_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organization_change_log_tenant_changed_by') THEN
    ALTER TABLE organization_change_log
      ADD CONSTRAINT fk_organization_change_log_tenant_changed_by
      FOREIGN KEY (tenant_id, changed_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_industry_terms_tenant_updated_by') THEN
    ALTER TABLE industry_terms
      ADD CONSTRAINT fk_industry_terms_tenant_updated_by
      FOREIGN KEY (tenant_id, updated_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_industry_module_overrides_tenant_updated_by') THEN
    ALTER TABLE industry_module_overrides
      ADD CONSTRAINT fk_industry_module_overrides_tenant_updated_by
      FOREIGN KEY (tenant_id, updated_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_marketing_leads_tenant_campaign') THEN
    ALTER TABLE marketing_leads
      ADD CONSTRAINT fk_marketing_leads_tenant_campaign
      FOREIGN KEY (tenant_id, marketing_campaign_id) REFERENCES marketing_campaigns(tenant_id, marketing_campaign_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_secret_rotation_tenant_rotated_by') THEN
    ALTER TABLE secret_rotation_events
      ADD CONSTRAINT fk_secret_rotation_tenant_rotated_by
      FOREIGN KEY (tenant_id, rotated_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_deployment_access_tenant_actor') THEN
    ALTER TABLE deployment_access_events
      ADD CONSTRAINT fk_deployment_access_tenant_actor
      FOREIGN KEY (tenant_id, actor_user_id) REFERENCES users(tenant_id, user_id);
  END IF;
END $$;

DO $$
DECLARE
  table_name text;
  policy_name text;
  scoped_tables text[] := ARRAY[
    'roles',
    'users',
    'user_roles',
    'clients',
    'estimates',
    'jobs',
    'workers',
    'assignments',
    'time_entries',
    'field_reports',
    'documents',
    'invoices',
    'expenses',
    'assets',
    'liabilities',
    'notifications',
    'audit_events',
    'auth_password_credentials',
    'auth_invitations',
    'auth_sessions',
    'auth_login_attempts',
    'storage_objects',
    'storage_object_versions',
    'storage_access_events',
    'event_outbox',
    'notification_queue',
    'client_contacts',
    'client_activities',
    'client_notes',
    'estimate_versions',
    'estimate_sections',
    'estimate_items',
    'estimate_approvals',
    'job_phases',
    'job_tasks',
    'job_change_requests',
    'job_incidents',
    'worker_profiles',
    'worker_availability',
    'worker_certifications',
    'break_entries',
    'attendance_approvals',
    'attendance_exceptions',
    'work_proofs',
    'field_report_checklist_items',
    'field_report_materials',
    'document_versions',
    'document_links',
    'document_permissions',
    'document_expiration_events',
    'invoice_items',
    'payments',
    'receipts',
    'invoice_status_history',
    'vendors',
    'expense_items',
    'expense_payments',
    'expense_status_history',
    'financial_accounts',
    'financial_transactions',
    'financial_reconciliations',
    'job_profitability_snapshots',
    'asset_maintenance',
    'asset_depreciation_entries',
    'liability_payment_schedule',
    'liability_documents',
    'organization_settings',
    'tenant_feature_flags',
    'organization_change_log',
    'tenant_industry_profiles',
    'industry_terms',
    'industry_module_overrides',
    'marketing_campaigns',
    'marketing_leads',
    'marketing_followups',
    'marketing_message_templates',
    'marketing_reviews',
    'installation_licenses',
    'secret_rotation_events',
    'deployment_access_events'
  ];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    policy_name := table_name || '_tenant_isolation';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;
