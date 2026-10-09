export type TxKind = 'income' | 'expense' | 'reimbursement' | 'card_payment';
export type PaymentMethod = 'credit' | 'debit';
export const TX_KINDS = ['income', 'expense', 'reimbursement', 'card_payment'] as const;
export const PAYMENT_METHODS = ['credit', 'debit'] as const;
