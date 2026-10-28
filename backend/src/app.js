
import express from "express";
import helmet from "helmet";
import cors from "cors";

import productRoutes from "./routes/productRoutes.js";

const app = express();

app.use(helmet());

app.use(
    cors({
        origin: "http://192.168.56.10:5173"
    })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "NAUDÉ API is running"
    });
});

app.use("/api/products", productRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

export default app;
