// Regras de horário da barbearia (usadas pelo servidor).
// Qualquer mudança aqui deve ser refletida também em src/components/BookingModal.tsx (lista de horários).
export const SLOT_MINUTES = 30;

export const timeToMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const minToTime = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function range(startMin: number, endMin: number): string[] {
  const out: string[] = [];
  for (let m = startMin; m < endMin; m += SLOT_MINUTES) out.push(minToTime(m));
  return out;
}

// Horários de INÍCIO possíveis no dia. Seg: fechado | Dom: 09h–14h | Ter–Sáb: 09h–19h
export function daySlots(date: string): string[] {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom, 1=Seg
  if (dow === 1) return [];
  if (dow === 0) return range(9 * 60, 14 * 60);
  return range(9 * 60, 19 * 60);
}

// Quais "fatias" de 30 min um atendimento ocupa (ex.: 60 min às 09:00 -> 09:00 e 09:30)
export function coveredSlots(time: string, durationMinutes: number): string[] {
  const n = Math.max(1, Math.ceil(durationMinutes / SLOT_MINUTES));
  return Array.from({ length: n }, (_, i) => minToTime(timeToMin(time) + i * SLOT_MINUTES));
}
