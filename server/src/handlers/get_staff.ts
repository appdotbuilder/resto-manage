import { db } from '../db';
import { usersTable } from '../db/schema';
import { type GetStaffByRestaurantInput, type User } from '../schema';
import { eq, and, ne, SQL } from 'drizzle-orm';

export const getStaffByRestaurant = async (input: GetStaffByRestaurantInput): Promise<User[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];
    
    // Filter by restaurant_id (tenant isolation)
    conditions.push(eq(usersTable.restaurant_id, input.restaurant_id));
    
    // Exclude super admins (they don't belong to restaurants)
    conditions.push(ne(usersTable.role, 'SUPER_ADMIN'));

    // Apply pagination parameters
    const limit = input.limit || 50; // Default limit
    const offset = input.offset || 0; // Default offset

    // Build and execute query in one go
    const results = await db.select()
      .from(usersTable)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .execute();

    // Return the results (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Failed to fetch staff by restaurant:', error);
    throw error;
  }
};

export const getStaffMember = async (userId: number, restaurantId: number): Promise<User | null> => {
  try {
    // Query for specific user with tenant isolation
    const results = await db.select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, userId),
          eq(usersTable.restaurant_id, restaurantId),
          ne(usersTable.role, 'SUPER_ADMIN') // Exclude super admins
        )
      )
      .limit(1)
      .execute();

    // Return first result or null
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch staff member:', error);
    throw error;
  }
};