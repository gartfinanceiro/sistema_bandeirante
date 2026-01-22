import { Sidebar } from "./Sidebar";

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    return (
        <div className="min-h-screen flex">
            <Sidebar />
            <main className="flex-1 lg:ml-0">
                <div className="p-4 lg:p-8 pt-16 lg:pt-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
