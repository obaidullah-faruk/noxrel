"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Build the enum type once, with create_type=False so create_table never
# re-emits CREATE TYPE. The type itself is created idempotently below.
subscription_status = postgresql.ENUM(
    "trialing",
    "active",
    "past_due",
    "cancelled",
    "paused",
    "incomplete",
    name="subscription_status",
    create_type=False,
)


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE subscription_status AS ENUM
                ('trialing', 'active', 'past_due', 'cancelled', 'paused', 'incomplete');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
        sa.Column("stripe_price_id", sa.String(128), nullable=False, server_default=""),
        sa.Column("stripe_product_id", sa.String(128), nullable=False, server_default=""),
        sa.Column("billing_interval", sa.String(8), nullable=False),
        sa.Column("price_usd", sa.Numeric(8, 2), nullable=False),
        sa.Column("max_quality", sa.String(8), nullable=False),
        sa.Column("simultaneous_streams", sa.Integer, nullable=False),
        sa.Column("can_download", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        if_not_exists=True,
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("stripe_subscription_id", sa.String(128), unique=True, nullable=True),
        sa.Column("stripe_customer_id", sa.String(128), nullable=False),
        sa.Column("status", subscription_status, nullable=False),
        sa.Column("trial_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        if_not_exists=True,
    )

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "subscription_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("subscriptions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stripe_invoice_id", sa.String(128), nullable=False, unique=True),
        sa.Column("amount_usd", sa.Numeric(8, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("invoice_pdf_url", sa.Text, nullable=False, server_default=""),
        sa.Column("billing_reason", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        if_not_exists=True,
    )

    op.create_table(
        "payment_methods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("stripe_payment_method_id", sa.String(128), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("card_brand", sa.String(20), nullable=False),
        sa.Column("last4", sa.String(4), nullable=False),
        sa.Column("exp_month", sa.Integer, nullable=False),
        sa.Column("exp_year", sa.Integer, nullable=False),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        if_not_exists=True,
    )

    # seed plans — ON CONFLICT makes this idempotent on retries
    op.execute("""
        INSERT INTO subscription_plans (id, name, billing_interval, price_usd, max_quality, simultaneous_streams, can_download, is_active)
        VALUES
            (gen_random_uuid(), 'free_trial',  'month', 0.00,  '1080p', 1, false, true),
            (gen_random_uuid(), 'basic',        'month', 9.99,  '1080p', 1, false, true),
            (gen_random_uuid(), 'premium',      'month', 15.99, '4K',    4, true,  true),
            (gen_random_uuid(), 'family',       'month', 19.99, '4K',    6, true,  true)
        ON CONFLICT (name) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("payment_methods")
    op.drop_table("invoices")
    op.drop_table("subscriptions")
    op.drop_table("subscription_plans")
    op.execute("DROP TYPE subscription_status")
