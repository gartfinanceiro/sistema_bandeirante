/**
 * Normalização do "fornecedor" a partir da descrição de um lançamento.
 *
 * IMPORTANTE: precisa ser IDÊNTICA à normalização usada no SQL (migrations 040/041 e a
 * view merchant_best_category), senão o lookup no mapa aprendido não bate. Equivalente a:
 *
 *   lower(trim(regexp_replace(split_part(description, '-', 1), '\s+', ' ', 'g')))
 *
 * Ou seja: pega o trecho antes do primeiro "-", colapsa espaços, tira pontas e minúscula.
 */
export function merchantKey(description: string): string {
    if (!description) return "";
    const beforeDash = description.split("-")[0]; // trecho antes do primeiro hífen
    return beforeDash
        .replace(/\s+/g, " ") // colapsa qualquer sequência de espaços/brancos
        .trim()
        .toLowerCase();
}
