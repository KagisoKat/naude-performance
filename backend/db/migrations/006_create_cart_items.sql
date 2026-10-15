
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cart_id UUID NOT NULL
        REFERENCES carts(id) ON DELETE CASCADE,

    variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cart_items_unique_variant
        UNIQUE (cart_id, variant_id)
);

CREATE INDEX idx_cart_items_variant_id
ON cart_items(variant_id);

