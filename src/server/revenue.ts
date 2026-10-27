// Cálculo de faturamento (usado por GET /api/admin/revenue).
// Regra: "faturado" = agendamento com pagamento PAGO e que não foi cancelado, contado no dia do atendimento.
// Pix online vira "pago" sozinho (webhook); pagamento no local vira "pago" quando o barbeiro marca na Agenda.

export interface RevenueRow {
  date: string;            // YYYY-MM-DD (dia do atendimento)
  price: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function summarizeRevenue(rows: RevenueRow[], today: string) {
  const paid = rows.filter((r) => r.paymentStatus === 'paid' && r.status !== 'cancelled');
  const sum = (list: RevenueRow[]) => round2(list.reduce((t, r) => t + (Number(r.price) || 0), 0));

  const byDayMap = new Map<string, { total: number; count: number }>();
  for (const r of paid) {
    const d = byDayMap.get(r.date) ?? { total: 0, count: 0 };
    d.total += Number(r.price) || 0;
    d.count += 1;
    byDayMap.set(r.date, d);
  }
  const days = [...byDayMap.entries()]
    .map(([date, v]) => ({ date, total: round2(v.total), count: v.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const method = (k: string) => {
    const l = paid.filter((r) => r.paymentMethod === k);
    return { total: sum(l), count: l.length };
  };
  const todayPaid = paid.filter((r) => r.date === today);
  const toReceive = rows.filter((r) => r.status === 'confirmed' && r.paymentStatus !== 'paid');
  const refunds = rows.filter((r) => r.status === 'cancelled' && r.paymentStatus === 'paid');

  return {
    month: { total: sum(paid), count: paid.length, average: paid.length ? round2(sum(paid) / paid.length) : 0 },
    today: { date: today, total: sum(todayPaid), count: todayPaid.length },
    toReceive: { total: sum(toReceive), count: toReceive.length },
    refundsNeeded: { total: sum(refunds), count: refunds.length },
    byMethod: { pix: method('pix'), in_person: method('in_person'), card: method('card') },
    days,
  };
}
