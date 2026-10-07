import Header from "./Header";
import Sidebar from "./Sidebar";

interface AppShellProps {
    children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    return (
        <div>
            <Sidebar />

            <div>
                <Header />

                <main>
                    {children}
                </main>
            </div>
        </div>
    );
}