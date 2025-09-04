import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { restaurantsTable, subscriptionsTable } from '../db/schema';
import { getSubscriptionByRestaurant } from '../handlers/get_subscription';

describe('getSubscriptionByRestaurant', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return subscription for existing restaurant', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurantId = restaurantResult[0].id;

    // Create test subscription
    const subscriptionResult = await db.insert(subscriptionsTable)
      .values({
        restaurant_id: restaurantId,
        tier: 'BASIC',
        status: 'ACTIVE',
        stripe_subscription_id: 'sub_test123',
        stripe_customer_id: 'cus_test456'
      })
      .returning()
      .execute();

    const result = await getSubscriptionByRestaurant(restaurantId);

    expect(result).not.toBeNull();
    expect(result?.id).toEqual(subscriptionResult[0].id);
    expect(result?.restaurant_id).toEqual(restaurantId);
    expect(result?.tier).toEqual('BASIC');
    expect(result?.status).toEqual('ACTIVE');
    expect(result?.stripe_subscription_id).toEqual('sub_test123');
    expect(result?.stripe_customer_id).toEqual('cus_test456');
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent restaurant', async () => {
    const result = await getSubscriptionByRestaurant(999999);
    
    expect(result).toBeNull();
  });

  it('should return null for restaurant without subscription', async () => {
    // Create test restaurant but no subscription
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant Without Subscription',
        email: 'no-sub@restaurant.com'
      })
      .returning()
      .execute();

    const restaurantId = restaurantResult[0].id;

    const result = await getSubscriptionByRestaurant(restaurantId);
    
    expect(result).toBeNull();
  });

  it('should handle subscription with nullable dates correctly', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurantId = restaurantResult[0].id;

    // Create subscription with nullable date fields
    await db.insert(subscriptionsTable)
      .values({
        restaurant_id: restaurantId,
        tier: 'FREE',
        status: 'TRIALING',
        current_period_start: null,
        current_period_end: null
      })
      .returning()
      .execute();

    const result = await getSubscriptionByRestaurant(restaurantId);

    expect(result).not.toBeNull();
    expect(result?.current_period_start).toBeNull();
    expect(result?.current_period_end).toBeNull();
    expect(result?.tier).toEqual('FREE');
    expect(result?.status).toEqual('TRIALING');
  });

  it('should handle subscription with valid period dates', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurantId = restaurantResult[0].id;

    const periodStart = new Date('2024-01-01');
    const periodEnd = new Date('2024-02-01');

    // Create subscription with period dates
    await db.insert(subscriptionsTable)
      .values({
        restaurant_id: restaurantId,
        tier: 'PROFESSIONAL',
        status: 'ACTIVE',
        current_period_start: periodStart,
        current_period_end: periodEnd
      })
      .returning()
      .execute();

    const result = await getSubscriptionByRestaurant(restaurantId);

    expect(result).not.toBeNull();
    expect(result?.current_period_start).toBeInstanceOf(Date);
    expect(result?.current_period_end).toBeInstanceOf(Date);
    expect(result?.current_period_start?.toISOString()).toEqual(periodStart.toISOString());
    expect(result?.current_period_end?.toISOString()).toEqual(periodEnd.toISOString());
  });

  it('should return first subscription when multiple exist for same restaurant', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurantId = restaurantResult[0].id;

    // Create multiple subscriptions (this shouldn't happen in normal business logic, but test the query behavior)
    const firstSub = await db.insert(subscriptionsTable)
      .values({
        restaurant_id: restaurantId,
        tier: 'BASIC',
        status: 'ACTIVE'
      })
      .returning()
      .execute();

    await db.insert(subscriptionsTable)
      .values({
        restaurant_id: restaurantId,
        tier: 'PROFESSIONAL',
        status: 'CANCELED'
      })
      .returning()
      .execute();

    const result = await getSubscriptionByRestaurant(restaurantId);

    expect(result).not.toBeNull();
    // Should return the first subscription due to limit(1)
    expect(result?.id).toEqual(firstSub[0].id);
    expect(result?.tier).toEqual('BASIC');
  });
});