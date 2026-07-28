# Hosted beta sample data

`beta-demo.sql` creates a separate **Roventra Beta Demo** tenant containing synthetic customers,
pets, services, bookings, a waitlist entry, invoices, an in-care stay, care tasks, an operational
incident, and a published report card. The dataset is intended for visual and workflow review in
the hosted beta environment.

## Run it safely

1. Create and verify the beta owner account through the normal Roventra registration flow.
2. Open the hosted **beta** project in the Supabase dashboard.
3. Open SQL Editor and paste `beta-demo.sql` into a new query.
4. Replace `replace-with-beta-owner@example.com` with the verified beta owner's email address.
5. Confirm the selected Supabase project is beta, then run the complete query once.
6. Sign back into Roventra and switch to **Roventra Beta Demo**.

The script is transaction-bound and stops before creating records when the placeholder remains or
the email does not resolve to exactly one verified account. It creates no authentication password,
does not alter the selected owner's credentials, and uses stable idempotency keys so it can safely
resume after a successful prior run.

Do not add this script to `[db.seed]` in `supabase/config.toml`. The default local seed remains empty
so isolated database tests do not inherit business records.
