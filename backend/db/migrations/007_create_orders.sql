
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled'
        )),

    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN (
            'unpaid',
            'pending',
            'paid',
            'failed',
            'refunded',
            'partially_refunded'
        )),

    subtotal NUMERIC(12,2) NOT NULL
        CHECK (subtotal >= 0),

    shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (shipping_amount >= 0),

    total_amount NUMERIC(12,2)
        GENERATED ALWAYS AS (
            subtotal + shipping_amount
        ) STORED,

    shipping_address JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT orders_address_is_object
        CHECK (jsonb_typeof(shipping_address) = 'object')
);

CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);

CREATE INDEX idx_orders_status
ON orders(status);

