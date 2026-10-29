import {
    PORT,
    FRONTEND_ORIGIN,
    MONGODB_URI,
    MONGODB_DB_NAME
} from "../../config.js";

export const environment = Object.freeze({
    port: PORT,
    frontendOrigin: FRONTEND_ORIGIN,
    mongodbUri: MONGODB_URI,
    mongodbDbName: MONGODB_DB_NAME
});
