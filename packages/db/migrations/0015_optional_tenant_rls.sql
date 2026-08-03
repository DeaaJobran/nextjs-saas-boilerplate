DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT scoped_table.table_name, scoped_table.tenant_column
    FROM (
      SELECT columns.table_name, columns.column_name AS tenant_column
      FROM information_schema.columns AS columns
      WHERE columns.table_schema = 'public'
        AND columns.column_name = 'tenant_id'
        AND columns.is_nullable = 'NO'

      UNION ALL

      SELECT mapping.table_name, mapping.tenant_column
      FROM (VALUES
        ('organization_feature_flags', 'organization_id'),
        ('organization_usage_limits', 'organization_id'),
        ('organization_quotas', 'organization_id'),
        ('impersonation_sessions', 'organization_id'),
        ('tenant_audit_events', 'organization_id')
      ) AS mapping(table_name, tenant_column)
      WHERE EXISTS (
        SELECT 1
        FROM information_schema.columns AS columns
        WHERE columns.table_schema = 'public'
          AND columns.table_name = mapping.table_name
          AND columns.column_name = mapping.tenant_column
      )
    ) AS scoped_table
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I.%I',
      'public',
      target.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I.%I USING (%I = NULLIF(current_setting(''app.current_tenant_id'', true), '''')) WITH CHECK (%I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))',
      'public',
      target.table_name,
      target.tenant_column,
      target.tenant_column
    );
  END LOOP;
END;
$$;

-- Nullable tenant_id tables and identity/bootstrap tables intentionally stay
-- outside RLS so API-key discovery, tenant selection, invitations, and global
-- worker records remain available before a trusted tenant context exists.
-- Service authorization remains mandatory for every excluded table.
--
-- Policies are intentionally installed disabled. Enabling them is an explicit
-- deployment choice because privileged workers and migrations need a bypass path.
