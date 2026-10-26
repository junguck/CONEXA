import { z } from 'zod';

/** Montant en francs CFA : entier, jamais de décimales (API.md §1). */
export const MoneySchema = z
  .number()
  .int('Le montant doit être un entier de FCFA')
  .nonnegative('Le montant ne peut pas être négatif')
  .max(100_000_000, 'Montant hors plafond');

export type Money = z.infer<typeof MoneySchema>;

export const CURRENCY = 'XAF' as const;

export function assertMoney(value: number): Money {
  return MoneySchema.parse(value);
}

export function sumMoney(values: Money[]): Money {
  return assertMoney(values.reduce((total, value) => total + value, 0));
}

/** Applique une commission en pourcentage, arrondie au franc inférieur. */
export function commission(amount: Money, ratePercent: number): Money {
  if (ratePercent < 0 || ratePercent > 100) {
    throw new RangeError('Le taux de commission doit être entre 0 et 100');
  }
  return Math.floor((assertMoney(amount) * ratePercent) / 100);
}
