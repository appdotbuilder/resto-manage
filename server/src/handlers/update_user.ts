import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // Build the update object with only provided fields
    const updateFields: Partial<typeof usersTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.email !== undefined) updateFields.email = input.email;
    if (input.first_name !== undefined) updateFields.first_name = input.first_name;
    if (input.last_name !== undefined) updateFields.last_name = input.last_name;
    if (input.role !== undefined) updateFields.role = input.role;
    if (input.restaurant_id !== undefined) updateFields.restaurant_id = input.restaurant_id;
    if (input.is_active !== undefined) updateFields.is_active = input.is_active;

    // Update the user record
    const result = await db.update(usersTable)
      .set(updateFields)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`User with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};