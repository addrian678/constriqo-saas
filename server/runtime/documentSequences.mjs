export async function nextDocumentSequence(client, { tenantId, documentType, series = "default", fiscalYear = new Date().getFullYear() }) {
  const result = await client.query(
    `
      INSERT INTO document_sequences (tenant_id, document_type, series, fiscal_year, last_value)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (tenant_id, document_type, series, fiscal_year)
      DO UPDATE SET last_value = document_sequences.last_value + 1, updated_at = now()
      RETURNING last_value
    `,
    [tenantId, documentType, series, fiscalYear],
  );
  return Number(result.rows[0].last_value);
}

export function formatSequence(prefix, value, width = 5) {
  return `${prefix}-${String(value).padStart(width, "0")}`;
}
