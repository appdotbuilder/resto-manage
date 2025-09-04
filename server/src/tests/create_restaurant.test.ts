import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { restaurantsTable, subscriptionsTable } from '../db/schema';
import { type CreateRestaurantInput } from '../schema';
import { createRestaurant } from '../handlers/create_restaurant';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreateRestaurantInput = {
  name: 'Test Restaurant',
  description: 'A restaurant for testing',
  email: 'test@restaurant.com',
  phone: '+1234567890',
  address: '123 Test St',
  logo_url: 'https://example.com/logo.png',
  brand_color: '#FF5733'
};

// Test input with minimal required fields only
const minimalTestInput: CreateRestaurantInput = {
  name: 'Minimal Restaurant',
  email: 'minimal@restaurant.com'
};

describe('createRestaurant', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a restaurant with all fields', async () => {
    const result = await createRestaurant(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Restaurant');
    expect(result.description).toEqual('A restaurant for testing');
    expect(result.email).toEqual('test@restaurant.com');
    expect(result.phone).toEqual('+1234567890');
    expect(result.address).toEqual('123 Test St');
    expect(result.logo_url).toEqual('https://example.com/logo.png');
    expect(result.brand_color).toEqual('#FF5733');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a restaurant with minimal fields (nulls for optional)', async () => {
    const result = await createRestaurant(minimalTestInput);

    // Basic field validation
    expect(result.name).toEqual('Minimal Restaurant');
    expect(result.email).toEqual('minimal@restaurant.com');
    expect(result.description).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.logo_url).toBeNull();
    expect(result.brand_color).toBeNull();
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save restaurant to database', async () => {
    const result = await createRestaurant(testInput);

    // Query using proper drizzle syntax
    const restaurants = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, result.id))
      .execute();

    expect(restaurants).toHaveLength(1);
    expect(restaurants[0].name).toEqual('Test Restaurant');
    expect(restaurants[0].description).toEqual('A restaurant for testing');
    expect(restaurants[0].email).toEqual('test@restaurant.com');
    expect(restaurants[0].phone).toEqual('+1234567890');
    expect(restaurants[0].address).toEqual('123 Test St');
    expect(restaurants[0].logo_url).toEqual('https://example.com/logo.png');
    expect(restaurants[0].brand_color).toEqual('#FF5733');
    expect(restaurants[0].is_active).toEqual(true);
    expect(restaurants[0].created_at).toBeInstanceOf(Date);
    expect(restaurants[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create a default FREE subscription for the restaurant', async () => {
    const result = await createRestaurant(testInput);

    // Query for subscription with the restaurant ID
    const subscriptions = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.restaurant_id, result.id))
      .execute();

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].restaurant_id).toEqual(result.id);
    expect(subscriptions[0].tier).toEqual('FREE');
    expect(subscriptions[0].status).toEqual('ACTIVE');
    expect(subscriptions[0].stripe_subscription_id).toBeNull();
    expect(subscriptions[0].stripe_customer_id).toBeNull();
    expect(subscriptions[0].current_period_start).toBeNull();
    expect(subscriptions[0].current_period_end).toBeNull();
    expect(subscriptions[0].created_at).toBeInstanceOf(Date);
    expect(subscriptions[0].updated_at).toBeInstanceOf(Date);
  });

  it('should allow restaurants with duplicate emails', async () => {
    // Create first restaurant
    const result1 = await createRestaurant(testInput);

    // Create second restaurant with same email (should be allowed)
    const duplicateEmailInput: CreateRestaurantInput = {
      ...testInput,
      name: 'Different Restaurant Name'
    };
    const result2 = await createRestaurant(duplicateEmailInput);

    // Both restaurants should be created successfully with different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.email).toEqual(result2.email);
    expect(result1.name).not.toEqual(result2.name);
  });

  it('should create restaurants with unique IDs', async () => {
    const result1 = await createRestaurant({
      name: 'Restaurant 1',
      email: 'restaurant1@test.com'
    });

    const result2 = await createRestaurant({
      name: 'Restaurant 2',
      email: 'restaurant2@test.com'
    });

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.id).toBeGreaterThan(0);
    expect(result2.id).toBeGreaterThan(0);
  });

  it('should handle undefined optional fields correctly', async () => {
    const inputWithUndefined: CreateRestaurantInput = {
      name: 'Test Restaurant',
      email: 'test@restaurant.com',
      description: undefined,
      phone: undefined,
      address: undefined,
      logo_url: undefined,
      brand_color: undefined
    };

    const result = await createRestaurant(inputWithUndefined);

    expect(result.description).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.logo_url).toBeNull();
    expect(result.brand_color).toBeNull();
  });
});