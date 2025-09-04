import { db } from '../db';
import { subscriptionsTable, restaurantsTable } from '../db/schema';
import { type CreateSubscriptionInput, type Subscription } from '../schema';
import { eq } from 'drizzle-orm';

export const createSubscription = async (input: CreateSubscriptionInput): Promise<Subscription> => {
  try {
    // Verify restaurant exists
    const restaurants = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, input.restaurant_id))
      .execute();

    if (restaurants.length === 0) {
      throw new Error('Restaurant not found');
    }

    // Set up billing cycle dates for paid tiers
    const currentPeriodStart = input.tier !== 'FREE' ? new Date() : null;
    const currentPeriodEnd = input.tier !== 'FREE' 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      : null;

    // Insert subscription record
    const result = await db.insert(subscriptionsTable)
      .values({
        restaurant_id: input.restaurant_id,
        tier: input.tier,
        status: 'ACTIVE',
        stripe_customer_id: input.stripe_customer_id || null,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Subscription creation failed:', error);
    throw error;
  }
};