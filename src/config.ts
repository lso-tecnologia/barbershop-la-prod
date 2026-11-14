/**
 * Pagamento online (Pix com QR Code via Mercado Pago).
 * DESLIGADO: hoje só existe "pagar no local".
 * Para religar: coloque true aqui E crie ONLINE_PAYMENTS=true na Vercel (o servidor também precisa liberar),
 * além de ter o MP_ACCESS_TOKEN de produção ativado. Veja ALTERACOES_CACHE_PIX_PACOTES_AVISO.md.
 */
export const ONLINE_PAYMENT_ENABLED = false;
