import { db } from '../db';
import { restaurantsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateRestaurantInput, type Restaurant } from '../schema';

export const updateRestaurant = async (input: UpdateRestaurantInput): Promise<Restaurant> => {
  try {
    // Check if restaurant exists
    const existingRestaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, input.id))
      .execute();

    if (existingRestaurant.length === 0) {
      throw new Error(`Restaurant with ID ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.email !== undefined) {
      updateData.email = input.email;
    }
    if (input.phone !== undefined) {
      updateData.phone = input.phone;
    }
    if (input.address !== undefined) {
      updateData.address = input.address;
    }
    if (input.logo_url !== undefined) {
      updateData.logo_url = input.logo_url;
    }
    if (input.brand_color !== undefined) {
      updateData.brand_color = input.brand_color;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Update restaurant record
    const result = await db.update(restaurantsTable)
      .set(updateData)
      .where(eq(restaurantsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Restaurant update failed:', error);
    throw error;
  }
};