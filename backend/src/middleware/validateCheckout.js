import { z } from "zod";

const shippingAddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20)
});

const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema
});

export function validateCheckout(req, res, next) {
  const result = checkoutSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "A valid shipping address is required"
    });
  }

  req.shippingAddress = result.data.shippingAddress;
  next();
}
