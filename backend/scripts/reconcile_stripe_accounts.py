"""
Reconcile Stripe subscribers with Supabase accounts.

Finds every Stripe customer with a live subscription (trialing / active /
past_due) and checks that a Supabase auth user + profiles row exists for the
customer's email and carries the Stripe ids. This is the backfill for the
bug where the old browser-side signup could leave a paying Stripe subscriber
with no login at all.

Usage (from the backend/ directory, with .env present):

    python scripts/reconcile_stripe_accounts.py            # report only
    python scripts/reconcile_stripe_accounts.py --fix      # create missing
                                                           # accounts, stamp
                                                           # profiles, email
                                                           # set-password links
    python scripts/reconcile_stripe_accounts.py --fix --no-email
    python scripts/reconcile_stripe_accounts.py --email someone@example.com
    python scripts/reconcile_stripe_accounts.py --include-inactive   # also
                                        # canceled/unpaid subs (e.g. disputed)

Report columns:
    MISSING_ACCOUNT   Stripe subscriber with no Supabase user for that email
    MISSING_STAMP     account exists but profile has no / a different
                      stripe_customer_id (paid-access gate treats as unpaid)
    OK                account exists and is stamped
"""

import argparse
import logging
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

import stripe  # noqa: E402
from supabase import create_client  # noqa: E402

from account_provisioning import (  # noqa: E402
    ensure_paid_account,
    find_user_id_by_email,
    send_set_password_email,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("reconcile")

LIVE = ("trialing", "active", "past_due")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fix", action="store_true", help="create missing accounts / stamp profiles")
    ap.add_argument("--no-email", action="store_true", help="with --fix: don't send set-password emails")
    ap.add_argument("--email", help="only reconcile this customer email")
    ap.add_argument("--include-inactive", action="store_true", help="also inspect canceled/unpaid/incomplete subscriptions")
    args = ap.parse_args()

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    supabase_url = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not stripe.api_key or not service_key:
        sys.exit("STRIPE_SECRET_KEY and SUPABASE_SERVICE_KEY must be set (backend/.env)")
    supabase = create_client(supabase_url, service_key)

    # Collect one row per Stripe customer: the "best" subscription (live first).
    by_customer = {}
    for sub in stripe.Subscription.list(status="all", limit=100, expand=["data.customer"]).auto_paging_iter():
        status = sub.get("status")
        if status not in LIVE and not args.include_inactive:
            continue
        cust = sub.get("customer")
        cust_id = cust["id"] if isinstance(cust, dict) else cust
        email = ((cust.get("email") if isinstance(cust, dict) else None) or sub.get("metadata", {}).get("email") or "").strip().lower()
        if args.email and email != args.email.strip().lower():
            continue
        cur = by_customer.get(cust_id)
        if cur is None or (status in LIVE and cur["status"] not in LIVE):
            by_customer[cust_id] = {"customer_id": cust_id, "email": email, "sub": sub, "status": status}

    rows = []
    for cust_id, info in by_customer.items():
        email, sub, status = info["email"], info["sub"], info["status"]
        if not email:
            rows.append(("NO_EMAIL", cust_id, "", status, sub["id"]))
            continue

        user_id = find_user_id_by_email(supabase, email)
        stamped = False
        if user_id:
            prof = (supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).limit(1).execute().data or [{}])[0]
            stamped = prof.get("stripe_customer_id") == cust_id

        if not user_id:
            state = "MISSING_ACCOUNT"
        elif not stamped:
            state = "MISSING_STAMP"
        else:
            state = "OK"

        if state != "OK" and args.fix and status in LIVE:
            uid, created = ensure_paid_account(
                supabase,
                email=email,
                customer_id=cust_id,
                subscription_id=sub["id"],
                sub_status=status,
                trial_end_ts=sub.get("trial_end"),
                metadata=dict(sub.get("metadata") or {}),
                monthly_tokens=25,
                provisioned_by="reconcile-script",
                notify_if_created=not args.no_email,
            )
            if not created and state == "MISSING_ACCOUNT":
                # Account existed under a different lookup path; still needs a way in.
                if not args.no_email:
                    send_set_password_email(supabase, email)
            state += " -> FIXED" + (" (account created)" if created else " (stamped)")
            user_id = uid

        rows.append((state, cust_id, email, status, sub["id"], user_id or ""))

    print()
    print(f"{'STATE':<36} {'STRIPE_CUSTOMER':<20} {'EMAIL':<36} {'SUB_STATUS':<10} {'SUBSCRIPTION':<30} USER_ID")
    for r in sorted(rows, key=lambda x: (x[0].startswith("OK"), x[2])):
        print(f"{r[0]:<36} {r[1]:<20} {r[2]:<36} {r[3]:<10} {r[4]:<30} {r[5] if len(r) > 5 else ''}")
    problems = [r for r in rows if not r[0].startswith("OK")]
    print(f"\n{len(rows)} Stripe customers inspected, {len(problems)} need attention"
          + ("" if args.fix else " (re-run with --fix to repair)"))


if __name__ == "__main__":
    main()
