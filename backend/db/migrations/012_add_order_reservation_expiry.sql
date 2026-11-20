ALTER TABLE orders
ADD COLUMN reservation_expires_at TIMESTAMPTZ;

UPDATE orders
SET reservation_expires_at = NOW() + INTERVAL '30 minutes'
WHERE status = 'pending'
  AND payment_status = 'unpaid';

ALTER TABLE orders
ALTER COLUMN reservation_expires_at
SET DEFAULT (NOW() + INTERVAL '30 minutes');

CREATE INDEX idx_orders_reservation_expiry
ON orders (reservation_expires_at, id)
WHERE status = 'pending'
  AND payment_status = 'unpaid';
