
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    variant_id UUID NOT NULL UNIQUE
        REFERENCES product_variants(id) ON DELETE RESTRICT,

    quantity_on_hand INTEGER NOT NULL DEFAULT 0
        CHECK (quantity_on_hand >= 0),

    quantity_reserved INTEGER NOT NULL DEFAULT 0
        CHECK (quantity_reserved >= 0),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT inventory_reservation_limit
        CHECK (quantity_reserved <= quantity_on_hand)
);

