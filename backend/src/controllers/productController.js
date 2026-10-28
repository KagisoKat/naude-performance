
import {
  getAllProducts,
  getProductBySlug
} from "../services/productService.js";

export async function getProducts(req, res, next) {
  try {
    const products = await getAllProducts();

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
}

export async function getProduct(req, res, next) {
  try {
    const { slug } = req.params;

    const product = await getProductBySlug(slug);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
}

