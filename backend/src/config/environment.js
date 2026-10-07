import "dotenv/config";

export const environment = {
    port: process.env.PORT || 3000,
    frontendOrigin:
        process.env.FRONTEND_ORIGIN || "http://localhost:3001",
};