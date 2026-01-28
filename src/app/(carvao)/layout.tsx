import { CarvaoShell } from "@/components/carvao/CarvaoShell";

export default function CarvaoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <CarvaoShell>{children}</CarvaoShell>;
}
