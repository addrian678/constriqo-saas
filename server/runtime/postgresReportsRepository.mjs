import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

export function createPostgresReportsRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresReportsRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresReportsRepository(pool) {
  async function queryForTenant(context, callback) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenant.tenantId]);
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function getSummary(context) {
    return queryForTenant(context, async (client) => {
      const tenantId = context.tenant.tenantId;
      const settings = await singleRow(client, "SELECT currency FROM tenants WHERE tenant_id = $1", [tenantId]);
      const financial = await singleRow(
        client,
        `
          SELECT
            COALESCE((SELECT sum(total_amount) FROM invoices WHERE tenant_id = $1 AND status <> 'void'), 0)::numeric AS income,
            COALESCE((SELECT sum(total_amount) FROM expenses WHERE tenant_id = $1 AND status <> 'void'), 0)::numeric AS expenses,
            COALESCE((SELECT sum(balance_amount) FROM invoices WHERE tenant_id = $1 AND status <> 'void'), 0)::numeric AS receivables,
            COALESCE((SELECT sum(balance_amount) FROM expenses WHERE tenant_id = $1 AND status <> 'void'), 0)::numeric AS payables,
            COALESCE((SELECT sum(book_value) FROM assets WHERE tenant_id = $1), 0)::numeric AS assets,
            COALESCE((SELECT sum(balance_amount) FROM liabilities WHERE tenant_id = $1), 0)::numeric AS liabilities
        `,
        [tenantId],
      );
      const operations = await singleRow(
        client,
        `
          SELECT
            (SELECT count(*) FROM clients WHERE tenant_id = $1 AND status <> 'archived')::integer AS clients,
            (SELECT count(*) FROM jobs WHERE tenant_id = $1 AND status <> 'closed')::integer AS open_jobs,
            (SELECT count(*) FROM workers WHERE tenant_id = $1 AND status = 'active')::integer AS active_workers,
            (SELECT count(*) FROM job_tasks WHERE tenant_id = $1)::integer AS tasks,
            (SELECT count(*) FROM job_tasks WHERE tenant_id = $1 AND status = 'completed')::integer AS completed_tasks
        `,
        [tenantId],
      );
      const attendance = await singleRow(
        client,
        `
          SELECT
            count(*) FILTER (WHERE clock_in >= date_trunc('month', now()))::integer AS entries_month,
            count(*) FILTER (WHERE clock_out IS NULL)::integer AS open_entries,
            COALESCE(sum(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) FILTER (WHERE clock_out IS NOT NULL AND clock_in >= date_trunc('month', now())), 0)::numeric AS hours_month
          FROM time_entries
          WHERE tenant_id = $1
        `,
        [tenantId],
      );
      const marketing = await singleRow(
        client,
        `
          SELECT
            (SELECT count(*) FROM marketing_campaigns WHERE tenant_id = $1)::integer AS campaigns,
            (SELECT count(*) FROM marketing_leads WHERE tenant_id = $1)::integer AS leads,
            (SELECT count(*) FROM marketing_leads WHERE tenant_id = $1 AND status = 'converted')::integer AS converted_leads,
            (SELECT count(*) FROM marketing_loyalty_cards WHERE tenant_id = $1 AND status = 'active')::integer AS active_loyalty_cards,
            (SELECT count(*) FROM marketing_loyalty_cards WHERE tenant_id = $1 AND status = 'active' AND current_stamps >= required_stamps)::integer AS ready_loyalty_cards
        `,
        [tenantId],
      );
      const control = await singleRow(
        client,
        `
          SELECT
            (SELECT count(*) FROM audit_events WHERE tenant_id = $1 AND created_at >= now() - interval '30 days')::integer AS audit_events_30d,
            (SELECT count(*) FROM notification_queue WHERE tenant_id = $1 AND status = 'pending')::integer AS pending_notifications,
            (SELECT count(*) FROM documents WHERE tenant_id = $1 AND status <> 'archived')::integer AS active_documents
        `,
        [tenantId],
      );

      const income = Number(financial.income || 0);
      const expenses = Number(financial.expenses || 0);
      const assets = Number(financial.assets || 0) + Number(financial.receivables || 0);
      const liabilities = Number(financial.liabilities || 0) + Number(financial.payables || 0);

      return {
        currency: settings.currency || "USD",
        generatedAt: new Date().toISOString(),
        financial: {
          income,
          expenses,
          netProfit: income - expenses,
          receivables: Number(financial.receivables || 0),
          payables: Number(financial.payables || 0),
          assets,
          liabilities,
          equity: assets - liabilities,
        },
        operations: {
          clients: Number(operations.clients || 0),
          openJobs: Number(operations.open_jobs || 0),
          activeWorkers: Number(operations.active_workers || 0),
          tasks: Number(operations.tasks || 0),
          completedTasks: Number(operations.completed_tasks || 0),
        },
        attendance: {
          entriesMonth: Number(attendance.entries_month || 0),
          openEntries: Number(attendance.open_entries || 0),
          hoursMonth: Math.round(Number(attendance.hours_month || 0) * 100) / 100,
        },
        marketing: {
          campaigns: Number(marketing.campaigns || 0),
          leads: Number(marketing.leads || 0),
          convertedLeads: Number(marketing.converted_leads || 0),
          activeLoyaltyCards: Number(marketing.active_loyalty_cards || 0),
          readyLoyaltyCards: Number(marketing.ready_loyalty_cards || 0),
        },
        control: {
          auditEvents30d: Number(control.audit_events_30d || 0),
          pendingNotifications: Number(control.pending_notifications || 0),
          activeDocuments: Number(control.active_documents || 0),
        },
      };
    });
  }

  return { getSummary };
}

async function singleRow(client, query, params) {
  const result = await client.query(query, params);
  return result.rows[0] || {};
}
