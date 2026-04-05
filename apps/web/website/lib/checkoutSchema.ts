import { z } from 'zod';

/** Nepal-oriented mobile: digits, optional +977 prefix and spaces */
const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Mobile number is required')
  .refine((s) => {
    const digits = s.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  }, 'Enter a valid mobile number (at least 9 digits)');

export const checkoutDetailsSchema = z.object({
  addressTitle: z.string().trim().min(1, 'Address title is required'),
  recipientName: z.string().trim().min(2, 'Full name is required'),
  recipientPhone: phoneSchema,
  houseFlat: z.string().trim().min(1, 'House / flat number is required'),
  landmark: z.string().trim().optional(),
});

export type CheckoutDetailsForm = z.infer<typeof checkoutDetailsSchema>;

export function buildDeliveryNotes(details: CheckoutDetailsForm): string {
  const landmark = details.landmark?.trim();
  const parts = [
    `Recipient: ${details.recipientName.trim()}`,
    `Phone: ${details.recipientPhone.replace(/\s/g, '')}`,
    `Label: ${details.addressTitle.trim()}`,
    `House/Flat: ${details.houseFlat.trim()}`,
    landmark ? `Landmark: ${landmark}` : null,
  ].filter(Boolean) as string[];
  const s = parts.join(' | ');
  return s.length > 500 ? s.slice(0, 500) : s;
}
