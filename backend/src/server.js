import app from "./app.js";
import { environment } from "./config/environment.js";

app.listen(environment.port, () => {
    console.log(
        `Server running on http://localhost:${environment.port}`
    );
});