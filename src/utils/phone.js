/**
 * Normaliza um telefone para o formato E.164 (+5511987654321).
 * Remove qualquer caractere que não seja dígito e garante o prefixo "+".
 */
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  return `+${digits}`;
}

module.exports = { normalizePhone };
