import Link from "next/link";
import { ROUTES } from "../../config";

export default function NotFound() {
    return (
        <section className="client-section">
            <h1>404 — Page Not Found</h1>
            <p>The page you requested does not exist.</p>

            <Link href={ROUTES.dashboard}>
                Return to Dashboard
            </Link>
        </section>
    );
}