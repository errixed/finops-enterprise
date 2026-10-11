"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { ROUTES } from "../../../config";

interface AppShellProps {
    children: ReactNode;
}

const navItems = [
    { label: "Dashboard", href: ROUTES.dashboard, icon: "home" },
    { label: "Clients", href: ROUTES.clients, icon: "group" },
    { label: "Accounts", href: ROUTES.accounts, icon: "account_balance_wallet" },
    { label: "Transactions", href: ROUTES.transactions, icon: "receipt_long" }
];

function isActive(pathname: string, href: string) {
    if (href === "/") {
        return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    return (
        <div className="app-shell">
            {menuOpen && (
                <button
                    type="button"
                    className="sidebar-overlay"
                    aria-label="Close navigation"
                    onClick={() => setMenuOpen(false)}
                />
            )}

            <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
                <div className="sidebar-brand">
                    <span className="material-symbols-rounded">
                        account_balance
                    </span>
                    <span>Financial Operations</span>

                    <button
                        type="button"
                        className="sidebar-close"
                        aria-label="Close menu"
                        onClick={() => setMenuOpen(false)}
                    >
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link ${
                                isActive(pathname, item.href) ? "active" : ""
                            }`}
                            onClick={() => setMenuOpen(false)}
                        >
                            <span className="material-symbols-rounded">
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            </aside>

            <div className="app-main">
                <header className="topbar">
                    <button
                        type="button"
                        className="mobile-menu-button"
                        aria-label="Open navigation"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(true)}
                    >
                        <span className="material-symbols-rounded">menu</span>
                    </button>

                    <div className="topbar-user">
                        <div className="user-avatar">JD</div>
                        <span className="user-name">Jane Doe</span>
                        <span className="material-symbols-rounded user-arrow">
                            expand_more
                        </span>
                    </div>
                </header>

                <main className="app-content">{children}</main>
            </div>
        </div>
    );
}