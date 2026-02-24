import { z } from 'zod';

export const joinHouseholdSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(1, { message: 'Invite code is required' })
    .uuid({ message: 'Invalid invite code format' }),
});

export type JoinHouseholdFormData = z.infer<typeof joinHouseholdSchema>;
