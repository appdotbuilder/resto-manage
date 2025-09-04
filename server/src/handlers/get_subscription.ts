import { db } from '../db';
import { subscriptionsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Subscription } from '../schema';

export const getSubscriptionByRestaurant = async (restaurantId: number): Promise<Subscription | null> => {
  try {
    // Query for subscription by restaurant ID
    const result = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.restaurant_id, restaurantId))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return null;
    }

    const subscription = result[0];
    
    // Return subscription with proper date handling
    return {
      ...subscription,
      current_period_start: subscription.current_period_start || null,
      current_period_end: subscription.current_period_end || null,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at
    };
  } catch (error) {
    console.error('Failed to fetch subscription:', error);
    throw error;
  }
};