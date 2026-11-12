const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_POSTGRES_INTEGER = 2_147_483_647;

function isValidUuid(value) {
    return typeof value === "string" &&
        value.length === 36 &&
        UUID_PATTERN.test(value);
}

function isValidQuantity(quantity) {
    return Number.isInteger(quantity) &&
        quantity >= 1 &&
        quantity <= MAX_POSTGRES_INTEGER;
}

export function validateAddCartItem(req, res, next) {
    const { variantId, quantity } = req.body ?? {};

    if (!isValidUuid(variantId)) {
        return res.status(400).json({
            success: false,
            message: "variantId must be a valid UUID"
        });
    }

    if (!isValidQuantity(quantity)) {
        return res.status(400).json({
            success: false,
            message: "quantity must be a positive integer within the supported range"
        });
    }

    next();
}

export function validateCartItemId(req, res, next) {
    const { itemId } = req.params;

    if (!isValidUuid(itemId)) {
        return res.status(400).json({
            success: false,
            message: "itemId must be a valid UUID"
        });
    }

    next();
}

export function validateUpdateCartItem(req, res, next) {
    const { quantity } = req.body ?? {};

    if (!isValidQuantity(quantity)) {
        return res.status(400).json({
            success: false,
            message: "quantity must be a positive integer within the supported range"
        });
    }

    next();
}
