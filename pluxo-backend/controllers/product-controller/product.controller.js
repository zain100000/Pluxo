/**
 * @fileoverview Product controller – manages catalog CRUD
 * @module controllers/productController
 */

const Product = require("../../models/product-model/product.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utilities/cloudinary-utility/cloudinary.utility");

/**
 * Create new product (with variants & images)
 * @access Private (SuperAdmin)
 */
exports.addProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      stock,
      status,
      specifications,
      variants,
      availableAttributes,
      discount,
    } = req.body;

    // 1. Validate Image presence
    if (!req.files?.productImage?.length) {
      return res.status(400).json({
        success: false,
        message: "At least one product image required",
      });
    }

    // 2. Parse JSON fields (Handle strings from FormData)
    const parsedSpecs = specifications ? JSON.parse(specifications) : [];
    const parsedVariants = variants ? JSON.parse(variants) : [];
    const parsedAttrs = availableAttributes
      ? JSON.parse(availableAttributes)
      : [];

    // 3. Upload Images to Cloudinary
    const uploadedImages = await Promise.all(
      req.files.productImage.map((file) =>
        uploadToCloudinary(file, "productImage"),
      ),
    );
    const imageUrls = uploadedImages.map((img) => img.url);

    // 4. Create Product Instance
    const product = new Product({
      title,
      description,
      category: Array.isArray(category) ? category : [category],
      stock: Number(stock), // Note: Schema middleware will override this if variants exist
      status: status || "ACTIVE",
      productImage: imageUrls,
      addedBy: req.user.id,
      specifications: parsedSpecs,
      variants: parsedVariants,
      availableAttributes: parsedAttrs,
      price: Number(price),
      discount: Number(discount) || 0,
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      newProduct: product,
    });
  } catch (error) {
    console.error("Add product error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

/**
 * Get all products with populated user data
 * @access Public
 */
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("addedBy", "userName email")
      .populate({
        path: "reviews.user",
        select: "id profilePicture userName email",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      allProducts: products,
    });
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * Get single product details
 * @access Public
 */
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId)
      .populate("addedBy", "userName email")
      .populate("reviews.user", "profilePicture userName email");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      product,
    });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * Update product (metadata, variants, and image replacement)
 * @access Private (SuperAdmin)
 */
exports.updateProduct = async (req, res) => {
  try {
    if (req.user.role !== "SUPERADMIN") {
      return res
        .status(403)
        .json({ success: false, message: "SuperAdmin access required" });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const updates = {};
    const complexFields = [
      "category",
      "specifications",
      "variants",
      "availableAttributes",
      "discount"
    ];
    const numericFields = ["price", "stock"];
    const standardFields = ["title", "description", "status"];

    // 1. Process Standard & Numeric Fields
    [...standardFields, ...numericFields, ...complexFields].forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== "") {
        let value = req.body[field];

        if (complexFields.includes(field)) {
          try {
            value = typeof value === "string" ? JSON.parse(value) : value;
          } catch (e) {
            /* keep as is */
          }
        }

        if (numericFields.includes(field)) {
          value = Number(value);
          if (isNaN(value)) return;
        }

        updates[field] = value;
      }
    });

    // 2. Handle Image Overwrite
    if (req.files?.productImage?.length) {
      if (product.productImages?.length) {
        await Promise.all(
          product.productImages.map((url) =>
            deleteFromCloudinary(url).catch(() => {}),
          ),
        );
      }
      const uploaded = await Promise.all(
        req.files.productImage.map((file) =>
          uploadToCloudinary(file, "productImage"),
        ),
      );
      updates.productImages = uploaded.map((img) => img.url);
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No updates provided" });
    }

    // 3. Apply updates and use .save() to trigger schema pre-save hooks (for stock calculation)
    Object.assign(product, updates);
    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      updatedProduct: product,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

/**
 * Delete product and clean up images
 * @access Private (SuperAdmin)
 */
exports.deleteProduct = async (req, res) => {
  try {
    if (req.user.role !== "SUPERADMIN") {
      return res
        .status(403)
        .json({ success: false, message: "SuperAdmin access required" });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Clean up images in Cloudinary
    if (product.productImages?.length) {
      await Promise.all(
        product.productImages.map((url) =>
          deleteFromCloudinary(url).catch((err) =>
            console.error("Cloudinary delete failed:", err),
          ),
        ),
      );
    }

    await Product.findByIdAndDelete(req.params.productId);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
