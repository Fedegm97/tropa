export const ORDER_STATUS = {
  pending_payment: { label: "Pendiente de pago", tone: "warning" },
  paid: { label: "Pagado", tone: "accent" },
  delivered: { label: "Entregado", tone: "success" },
  canceled: { label: "Cancelado", tone: "neutral" },
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS;
export const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL"];
