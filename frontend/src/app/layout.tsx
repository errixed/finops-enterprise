import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0"
                />
            </head>
            <body>
                <AppShell>{children}</AppShell>
            </body>
        </html>
    );
}