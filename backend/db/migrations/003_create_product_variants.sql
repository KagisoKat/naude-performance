
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES products(id) ON DELETE RESTRICT,

    sku VARCHAR(100) NOT NULL UNIQUE,

    color VARCHAR(50) NOT NULL,
    size VARCHAR(30) NOT NULL,

    price_override NUMERIC(12,2)
        CHECK (price_override >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT variants_color_not_blank
        CHECK (LENGTH(TRIM(color)) > 0),

    CONSTRAINT variants_size_not_blank
        CHECK (LENGTH(TRIM(size)) > 0),

    CONSTRAINT variants_unique_combination
        UNIQUE (product_id, color, size)
);

CREATE INDEX idx_variants_product_id
ON product_variants(product_id);

