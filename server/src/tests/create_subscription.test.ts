import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { subscriptionsTable, restaurantsTable } from '../db/schema';
import { type CreateSubscriptionInput } from '../schema';
import { createSubscription } from '../handlers/create_subscription';
import { eq } from 'drizzle-orm';

describe('createSubscription', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testRestaurantId: number;

  beforeEach(async () => {
    // Create a test restaurant first
    const restaurant = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    testRestaurantId = restaurant[0].id;
  });

  it('should create a free subscription', async () => {
    const testInput: CreateSubscriptionInput = {
      restaurant_id: testRestaurantId,
      tier: 'FREE'
    };

    const result = await createSubscription(testInput);

    // Basic field validation
    expect(result.restaurant_id).toEqual(testRestaurantId);
    expect(result.tier).toEqual('FREE');
    expect(result.status).toEqual('ACTIVE');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Free tier should not have billing periods
    expect(result.current_period_start).toBeNull();
    expect(result.current_period_end).toBeNull();
    expect(result.stripe_customer_id).toBeNull();
    expect(result.stripe_subscription_id).toBeNull();
  });

  it('should create a basic subscription with billing cycle', async () => {
    const testInput: CreateSubscriptionInput = {
      restaurant_id: testRestaurantId,
      tier: 'BASIC',
      stripe_customer_id: 'cus_test123'
    };

    const result = await createSubscription(testInput);

    // Basic field validation
    expect(result.restaurant_id).toEqual(testRestaurantId);
    expect(result.tier).toEqual('BASIC');
    expect(result.status).toEqual('ACTIVE');
    expect(result.stripe_customer_id).toEqual('cus_test123');

    // Paid tier should have billing periods
    expect(result.current_period_start).toBeInstanceOf(Date);
    expect(result.current_period_end).toBeInstanceOf(Date);

    // Verify billing period is approximately 30 days
    const periodDuration = result.current_period_end!.getTime() - result.current_period_start!.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(periodDuration - thirtyDays)).toBeLessThan(1000); // Within 1 second tolerance
  });

  it('should create a professional subscription with billing cycle', async () => {
    const testInput: CreateSubscriptionInput = {
      restaurant_id: testRestaurantId,
      tier: 'PROFESSIONAL',
      stripe_customer_id: 'cus_test456'
    };

    const result = await createSubscription(testInput);

    // Basic field validation
    expect(result.restaurant_id).toEqual(testRestaurantId);
    expect(result.tier).toEqual('PROFESSIONAL');
    expect(result.status).toEqual('ACTIVE');
    expect(result.stripe_customer_id).toEqual('cus_test456');

    // Paid tier should have billing periods
    expect(result.current_period_start).toBeInstanceOf(Date);
    expect(result.current_period_end).toBeInstanceOf(Date);
  });

  it('should save subscription to database', async () => {
    const testInput: CreateSubscriptionInput = {
      restaurant_id: testRestaurantId,
      tier: 'BASIC',
      stripe_customer_id: 'cus_database_test'
    };

    const result = await createSubscription(testInput);

    // Query database to verify subscription was saved
    const subscriptions = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, result.id))
      .execute();

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].restaurant_id).toEqual(testRestaurantId);
    expect(subscriptions[0].tier).toEqual('BASIC');
    expect(subscriptions[0].status).toEqual('ACTIVE');
    expect(subscriptions[0].stripe_customer_id).toEqual('cus_database_test');
    expect(subscriptions[0].created_at).toBeInstanceOf(Date);
    expect(subscriptions[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle missing stripe_customer_id', async () => {
    const testInput: CreateSubscriptionInput = {
      restaurant_id: testRestaurantId,
      tier: 'BASIC'
      // No stripe_customer_id provided
    };

    const result = await createSubscription(testInput);

    expect(result.tier).toEqual('BASIC');
    expect(result.stripe_customer_id).toBeNull();
    // Should still have billing periods even without Stripe customer ID
    expect(result.current_period_start).toBeInstanceOf(Date);
    expect(result.current_period_end).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent restaurant', async () => {
    const testInput: CreateSubscriptionInput = {
      restaurant_id: 99999, // Non-existent restaurant ID
      tier: 'FREE'
    };

    await expect(createSubscription(testInput))
      .rejects
      .toThrow(/restaurant not found/i);
  });

  it('should query subscriptions by restaurant correctly', async () => {
    // Create multiple subscriptions for verification
    const testInput: CreateSubscriptionInput = {
      restaurant_id: testRestaurantId,
      tier: 'PROFESSIONAL',
      stripe_customer_id: 'cus_query_test'
    };

    await createSubscription(testInput);

    // Query subscriptions for the restaurant
    const subscriptions = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.restaurant_id, testRestaurantId))
      .execute();

    expect(subscriptions.length).toBeGreaterThan(0);
    subscriptions.forEach(subscription => {
      expect(subscription.restaurant_id).toEqual(testRestaurantId);
      expect(subscription.created_at).toBeInstanceOf(Date);
      expect(subscription.updated_at).toBeInstanceOf(Date);
    });
  });
});