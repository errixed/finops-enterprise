import express from "express";
import cors from "cors";

import { environment } from "./config/environment.js";
import routes from "./routes/index.js";
import notFoundMiddleware from "./middleware/not-found.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();

app.use(
    cors({
        origin: environment.frontendOrigin,
    })
);

app.use(express.json());

app.use("/api/v1", routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;