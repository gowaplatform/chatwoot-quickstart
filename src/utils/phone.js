/**
 * Normaliza um telefone para o formato E.164 (+5511987654321).
 * Remove qualquer caractere que não seja dígito e garante o prefixo "+".
 */
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).trim().replace(/\D/g, '');
  if (!digits) return null;
  const internationalDigits = digits.startsWith('00') ? digits.slice(2) : digits;
  if (!internationalDigits) return null;
  return `+${internationalDigits}`;
}

module.exports = { normalizePhone };
