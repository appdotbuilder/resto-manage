import { db } from '../db';
import { restaurantsTable, usersTable } from '../db/schema';
import { type Restaurant } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getRestaurant = async (restaurantId: number): Promise<Restaurant | null> => {
  try {
    const results = await db.select()
      .from(restaurantsTable)
      .where(and(
        eq(restaurantsTable.id, restaurantId),
        eq(restaurantsTable.is_active, true)
      ))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('Failed to get restaurant:', error);
    throw error;
  }
};

export const getRestaurantByUserId = async (userId: number): Promise<Restaurant | null> => {
  try {
    const results = await db.select({
      id: restaurantsTable.id,
      name: restaurantsTable.name,
      description: restaurantsTable.description,
      email: restaurantsTable.email,
      phone: restaurantsTable.phone,
      address: restaurantsTable.address,
      logo_url: restaurantsTable.logo_url,
      brand_color: restaurantsTable.brand_color,
      is_active: restaurantsTable.is_active,
      created_at: restaurantsTable.created_at,
      updated_at: restaurantsTable.updated_at
    })
      .from(usersTable)
      .innerJoin(restaurantsTable, eq(usersTable.restaurant_id, restaurantsTable.id))
      .where(and(
        eq(usersTable.id, userId),
        eq(usersTable.is_active, true),
        eq(restaurantsTable.is_active, true)
      ))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('Failed to get restaurant by user ID:', error);
    throw error;
  }
};