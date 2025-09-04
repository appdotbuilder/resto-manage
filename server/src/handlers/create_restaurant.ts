import { db } from '../db';
import { restaurantsTable, subscriptionsTable } from '../db/schema';
import { type CreateRestaurantInput, type Restaurant } from '../schema';

export const createRestaurant = async (input: CreateRestaurantInput): Promise<Restaurant> => {
  try {
    // Insert restaurant record
    const result = await db.insert(restaurantsTable)
      .values({
        name: input.name,
        description: input.description || null,
        email: input.email,
        phone: input.phone || null,
        address: input.address || null,
        logo_url: input.logo_url || null,
        brand_color: input.brand_color || null,
        is_active: true
      })
      .returning()
      .execute();

    const restaurant = result[0];

    // Create a default FREE subscription for the new restaurant
    await db.insert(subscriptionsTable)
      .values({
        restaurant_id: restaurant.id,
        tier: 'FREE',
        status: 'ACTIVE'
      })
      .execute();

    return restaurant;
  } catch (error) {
    console.error('Restaurant creation failed:', error);
    throw error;
  }
};