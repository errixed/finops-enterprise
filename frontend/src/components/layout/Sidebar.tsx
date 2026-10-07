"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside>
            <h2>Financial Operations</h2>

            <nav>
                <Link href="/">
                    Dashboard
                </Link>

                <Link href="/clients">
                    Clients
                </Link>

                <Link href="/accounts">
                    Accounts
                </Link>

                <Link href="/transactions">
                    Transactions
                </Link>
            </nav>
        </aside>
    );
}