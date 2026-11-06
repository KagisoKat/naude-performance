
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { createSessionMiddleware } from "./config/session.js";
import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { requireTrustedOrigin } from "./middleware/requireTrustedOrigin.js";
const app = express();

app.use(helmet());

app.use(cors({
    origin: "http://192.168.56.10:5173",
    credentials: true
}));

// Limit the size of incoming JSON request bodies.
app.use(express.json({ limit: "16kb" }));
app.use(createSessionMiddleware());
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "NAUDÉ API is running"
    });
});
app.use(requireTrustedOrigin);
// Product endpoints
app.use("/api/products", productRoutes);

// Authentication endpoints
app.use("/api/auth", authRoutes);

// Unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// Central error handler
app.use((error, req, res, next) => {
    console.error(error);

    if (error.status === 400 && error.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request body"
        });
    }

    if (error.status === 413) {
        return res.status(413).json({
            success: false,
            message: "Request body is too large"
        });
    }

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

export default app;
