ALTER TABLE billing_payment_providers
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

UPDATE billing_payment_providers
SET sort_order = 10,
    updated_at = now()
WHERE provider = 'stripe';

UPDATE billing_payment_providers
SET sort_order = 100,
    updated_at = now()
WHERE provider = 'mock';

UPDATE billing_invoices AS invoice
SET subscription_id = NULL
FROM billing_subscriptions AS subscription
WHERE invoice.subscription_id = subscription.id
  AND invoice.tenant_id <> subscription.tenant_id;

UPDATE billing_discounts AS discount
SET subscription_id = NULL
FROM billing_subscriptions AS subscription
WHERE discount.subscription_id = subscription.id
  AND discount.tenant_id <> subscription.tenant_id;

UPDATE billing_refunds AS refund
SET invoice_id = NULL
FROM billing_invoices AS invoice
WHERE refund.invoice_id = invoice.id
  AND refund.tenant_id <> invoice.tenant_id;

UPDATE billing_entitlements AS entitlement
SET subscription_id = NULL
FROM billing_subscriptions AS subscription
WHERE entitlement.subscription_id = subscription.id
  AND entitlement.tenant_id <> subscription.tenant_id;

CREATE OR REPLACE FUNCTION billing_reject_tenant_reassignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Billing records cannot be reassigned between tenants.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_customers_tenant_immutable ON billing_customers;
CREATE TRIGGER billing_customers_tenant_immutable
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION billing_reject_tenant_reassignment();

DROP TRIGGER IF EXISTS billing_subscriptions_tenant_immutable ON billing_subscriptions;
CREATE TRIGGER billing_subscriptions_tenant_immutable
  BEFORE UPDATE ON billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION billing_reject_tenant_reassignment();

DROP TRIGGER IF EXISTS billing_invoices_tenant_immutable ON billing_invoices;
CREATE TRIGGER billing_invoices_tenant_immutable
  BEFORE UPDATE ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION billing_reject_tenant_reassignment();

DROP TRIGGER IF EXISTS billing_payment_methods_tenant_immutable ON billing_payment_methods;
CREATE TRIGGER billing_payment_methods_tenant_immutable
  BEFORE UPDATE ON billing_payment_methods
  FOR EACH ROW EXECUTE FUNCTION billing_reject_tenant_reassignment();

DROP TRIGGER IF EXISTS billing_refunds_tenant_immutable ON billing_refunds;
CREATE TRIGGER billing_refunds_tenant_immutable
  BEFORE UPDATE ON billing_refunds
  FOR EACH ROW EXECUTE FUNCTION billing_reject_tenant_reassignment();

CREATE OR REPLACE FUNCTION billing_validate_tenant_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_id text;
  referenced_table text;
  referenced_tenant_id text;
BEGIN
  IF TG_TABLE_NAME IN ('billing_invoices', 'billing_discounts', 'billing_entitlements') THEN
    referenced_id := NEW.subscription_id;
    referenced_table := 'billing_subscriptions';
  ELSIF TG_TABLE_NAME = 'billing_refunds' THEN
    referenced_id := NEW.invoice_id;
    referenced_table := 'billing_invoices';
  END IF;

  IF referenced_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', referenced_table)
    INTO referenced_tenant_id
    USING referenced_id;

  IF referenced_tenant_id IS NOT NULL
     AND referenced_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Billing references must remain inside one tenant.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_invoices_tenant_reference ON billing_invoices;
CREATE TRIGGER billing_invoices_tenant_reference
  BEFORE INSERT OR UPDATE ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION billing_validate_tenant_reference();

DROP TRIGGER IF EXISTS billing_discounts_tenant_reference ON billing_discounts;
CREATE TRIGGER billing_discounts_tenant_reference
  BEFORE INSERT OR UPDATE ON billing_discounts
  FOR EACH ROW EXECUTE FUNCTION billing_validate_tenant_reference();

DROP TRIGGER IF EXISTS billing_refunds_tenant_reference ON billing_refunds;
CREATE TRIGGER billing_refunds_tenant_reference
  BEFORE INSERT OR UPDATE ON billing_refunds
  FOR EACH ROW EXECUTE FUNCTION billing_validate_tenant_reference();

DROP TRIGGER IF EXISTS billing_entitlements_tenant_reference ON billing_entitlements;
CREATE TRIGGER billing_entitlements_tenant_reference
  BEFORE INSERT OR UPDATE ON billing_entitlements
  FOR EACH ROW EXECUTE FUNCTION billing_validate_tenant_reference();
