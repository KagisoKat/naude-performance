import express from "express";
import helmet from "helmet";
import cors from "cors";

const app = express();

app.use(helmet());

app.use(
    cors({
        origin: "http://192.168.56.10:5173",
    })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "NAUDÉ API is running",
    });
});

export default app;