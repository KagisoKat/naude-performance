
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,

    variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,

    product_name VARCHAR(200) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(30) NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    unit_price NUMERIC(12,2) NOT NULL
        CHECK (unit_price >= 0),

    line_total NUMERIC(12,2)
        GENERATED ALWAYS AS (
            quantity * unit_price
        ) STORED,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT order_items_unique_variant
        UNIQUE (order_id, variant_id)
);

CREATE INDEX idx_order_items_variant_id
ON order_items(variant_id);

