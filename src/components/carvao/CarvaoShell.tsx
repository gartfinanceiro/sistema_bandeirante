import { CarvaoSidebar } from "./CarvaoSidebar";

interface CarvaoShellProps {
    children: React.ReactNode;
}

export function CarvaoShell({ children }: CarvaoShellProps) {
    return (
        <div className="min-h-screen flex">
            <CarvaoSidebar />
            <main className="flex-1 lg:ml-0">
                <div className="p-4 lg:p-8 pt-16 lg:pt-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
