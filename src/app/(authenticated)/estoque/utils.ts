export type VisualMaterialType = "carvao" | "minerio" | "fundentes" | "outros";

export function getVisualTypeFromName(name: string): VisualMaterialType {
    const n = name.toLowerCase();
    if (n.includes("carvão") || n.includes("carvao")) return "carvao";
    if (n.includes("minério") || n.includes("minerio") || n.includes("ferro")) return "minerio";
    if (n.includes("fundente") || n.includes("cal ") || n.includes("calcario")) return "fundentes";
    return "outros";
}
