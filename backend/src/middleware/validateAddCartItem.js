const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_POSTGRES_INTEGER = 2_147_483_647;

export function validateAddCartItem(req, res, next) {
    const { variantId, quantity } = req.body ?? {};

    if (
        typeof variantId !== "string" ||
        variantId.length !== 36 ||
        !UUID_PATTERN.test(variantId)
    ) {
        return res.status(400).json({
            success: false,
            message: "variantId must be a valid UUID"
        });
    }

    if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_POSTGRES_INTEGER
    ) {
        return res.status(400).json({
            success: false,
            message: "quantity must be a positive integer within the supported range"
        });
    }

    next();
}
