import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { restaurantsTable } from '../db/schema';
import { type UpdateRestaurantInput } from '../schema';
import { updateRestaurant } from '../handlers/update_restaurant';
import { eq } from 'drizzle-orm';

// Test restaurant data for setup
const testRestaurant = {
  name: 'Original Restaurant',
  description: 'Original description',
  email: 'original@example.com',
  phone: '+1234567890',
  address: '123 Original St',
  logo_url: 'https://example.com/original-logo.png',
  brand_color: '#ff0000',
  is_active: true
};

describe('updateRestaurant', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let restaurantId: number;

  beforeEach(async () => {
    // Create test restaurant
    const result = await db.insert(restaurantsTable)
      .values(testRestaurant)
      .returning()
      .execute();
    restaurantId = result[0].id;
  });

  it('should update restaurant with all fields', async () => {
    const updateInput: UpdateRestaurantInput = {
      id: restaurantId,
      name: 'Updated Restaurant Name',
      description: 'Updated description',
      email: 'updated@example.com',
      phone: '+9876543210',
      address: '456 Updated Ave',
      logo_url: 'https://example.com/updated-logo.png',
      brand_color: '#00ff00',
      is_active: false
    };

    const result = await updateRestaurant(updateInput);

    // Verify all fields were updated
    expect(result.id).toEqual(restaurantId);
    expect(result.name).toEqual('Updated Restaurant Name');
    expect(result.description).toEqual('Updated description');
    expect(result.email).toEqual('updated@example.com');
    expect(result.phone).toEqual('+9876543210');
    expect(result.address).toEqual('456 Updated Ave');
    expect(result.logo_url).toEqual('https://example.com/updated-logo.png');
    expect(result.brand_color).toEqual('#00ff00');
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update restaurant with partial fields', async () => {
    const updateInput: UpdateRestaurantInput = {
      id: restaurantId,
      name: 'Partially Updated Restaurant',
      email: 'partial@example.com'
    };

    const result = await updateRestaurant(updateInput);

    // Verify only specified fields were updated
    expect(result.name).toEqual('Partially Updated Restaurant');
    expect(result.email).toEqual('partial@example.com');
    
    // Verify other fields remain unchanged
    expect(result.description).toEqual('Original description');
    expect(result.phone).toEqual('+1234567890');
    expect(result.address).toEqual('123 Original St');
    expect(result.logo_url).toEqual('https://example.com/original-logo.png');
    expect(result.brand_color).toEqual('#ff0000');
    expect(result.is_active).toEqual(true);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update restaurant with null values', async () => {
    const updateInput: UpdateRestaurantInput = {
      id: restaurantId,
      description: null,
      phone: null,
      address: null,
      logo_url: null,
      brand_color: null
    };

    const result = await updateRestaurant(updateInput);

    // Verify nullable fields were set to null
    expect(result.description).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.logo_url).toBeNull();
    expect(result.brand_color).toBeNull();
    
    // Verify required fields remain unchanged
    expect(result.name).toEqual('Original Restaurant');
    expect(result.email).toEqual('original@example.com');
    expect(result.is_active).toEqual(true);
  });

  it('should persist updates to database', async () => {
    const updateInput: UpdateRestaurantInput = {
      id: restaurantId,
      name: 'Database Persisted Name',
      brand_color: '#0000ff'
    };

    await updateRestaurant(updateInput);

    // Query database directly to verify persistence
    const restaurants = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId))
      .execute();

    expect(restaurants).toHaveLength(1);
    expect(restaurants[0].name).toEqual('Database Persisted Name');
    expect(restaurants[0].brand_color).toEqual('#0000ff');
    expect(restaurants[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update only the updated_at timestamp when no other fields provided', async () => {
    // Get original timestamp
    const originalRestaurant = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId))
      .execute();

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateRestaurantInput = {
      id: restaurantId
    };

    const result = await updateRestaurant(updateInput);

    // Verify updated_at was changed but other fields remain the same
    expect(result.name).toEqual(originalRestaurant[0].name);
    expect(result.email).toEqual(originalRestaurant[0].email);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalRestaurant[0].updated_at.getTime());
  });

  it('should handle boolean field updates correctly', async () => {
    // First, set restaurant to inactive
    const deactivateInput: UpdateRestaurantInput = {
      id: restaurantId,
      is_active: false
    };

    const deactivatedResult = await updateRestaurant(deactivateInput);
    expect(deactivatedResult.is_active).toEqual(false);

    // Then reactivate
    const activateInput: UpdateRestaurantInput = {
      id: restaurantId,
      is_active: true
    };

    const activatedResult = await updateRestaurant(activateInput);
    expect(activatedResult.is_active).toEqual(true);
  });

  it('should throw error for non-existent restaurant', async () => {
    const updateInput: UpdateRestaurantInput = {
      id: 99999, // Non-existent ID
      name: 'Should Fail'
    };

    await expect(updateRestaurant(updateInput)).rejects.toThrow(/Restaurant with ID 99999 not found/i);
  });

  it('should validate hex color format in brand_color', async () => {
    // Valid hex colors should work
    const validColorInput: UpdateRestaurantInput = {
      id: restaurantId,
      brand_color: '#123abc'
    };

    const result = await updateRestaurant(validColorInput);
    expect(result.brand_color).toEqual('#123abc');

    // Short hex format should also work
    const shortHexInput: UpdateRestaurantInput = {
      id: restaurantId,
      brand_color: '#fff'
    };

    const shortResult = await updateRestaurant(shortHexInput);
    expect(shortResult.brand_color).toEqual('#fff');
  });

  it('should handle email updates correctly', async () => {
    const updateInput: UpdateRestaurantInput = {
      id: restaurantId,
      email: 'newemail@restaurant.com'
    };

    const result = await updateRestaurant(updateInput);
    expect(result.email).toEqual('newemail@restaurant.com');

    // Verify in database
    const restaurants = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId))
      .execute();

    expect(restaurants[0].email).toEqual('newemail@restaurant.com');
  });
});