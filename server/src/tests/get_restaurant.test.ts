import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { restaurantsTable, usersTable } from '../db/schema';
import { getRestaurant, getRestaurantByUserId } from '../handlers/get_restaurant';
import { eq } from 'drizzle-orm';

describe('getRestaurant', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get restaurant by ID', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        description: 'A test restaurant',
        email: 'test@restaurant.com',
        phone: '555-0123',
        address: '123 Test St',
        logo_url: 'https://example.com/logo.png',
        brand_color: '#FF5722',
        is_active: true
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Test successful retrieval
    const result = await getRestaurant(restaurant.id);

    expect(result).toBeDefined();
    expect(result?.id).toEqual(restaurant.id);
    expect(result?.name).toEqual('Test Restaurant');
    expect(result?.description).toEqual('A test restaurant');
    expect(result?.email).toEqual('test@restaurant.com');
    expect(result?.phone).toEqual('555-0123');
    expect(result?.address).toEqual('123 Test St');
    expect(result?.logo_url).toEqual('https://example.com/logo.png');
    expect(result?.brand_color).toEqual('#FF5722');
    expect(result?.is_active).toBe(true);
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent restaurant ID', async () => {
    const result = await getRestaurant(99999);

    expect(result).toBeNull();
  });

  it('should return null for inactive restaurant', async () => {
    // Create inactive restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Inactive Restaurant',
        email: 'inactive@restaurant.com',
        is_active: false
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    const result = await getRestaurant(restaurant.id);

    expect(result).toBeNull();
  });

  it('should handle restaurant with minimal fields', async () => {
    // Create restaurant with only required fields
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Minimal Restaurant',
        email: 'minimal@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    const result = await getRestaurant(restaurant.id);

    expect(result).toBeDefined();
    expect(result?.name).toEqual('Minimal Restaurant');
    expect(result?.email).toEqual('minimal@restaurant.com');
    expect(result?.description).toBeNull();
    expect(result?.phone).toBeNull();
    expect(result?.address).toBeNull();
    expect(result?.logo_url).toBeNull();
    expect(result?.brand_color).toBeNull();
    expect(result?.is_active).toBe(true); // Default value
  });
});

describe('getRestaurantByUserId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get restaurant by user ID', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'User Restaurant',
        description: 'Restaurant for user test',
        email: 'user@restaurant.com',
        phone: '555-0456',
        address: '456 User Ave',
        logo_url: 'https://example.com/user-logo.png',
        brand_color: '#2196F3',
        is_active: true
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'user@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'MANAGER',
        restaurant_id: restaurant.id,
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Test successful retrieval
    const result = await getRestaurantByUserId(user.id);

    expect(result).toBeDefined();
    expect(result?.id).toEqual(restaurant.id);
    expect(result?.name).toEqual('User Restaurant');
    expect(result?.description).toEqual('Restaurant for user test');
    expect(result?.email).toEqual('user@restaurant.com');
    expect(result?.phone).toEqual('555-0456');
    expect(result?.address).toEqual('456 User Ave');
    expect(result?.logo_url).toEqual('https://example.com/user-logo.png');
    expect(result?.brand_color).toEqual('#2196F3');
    expect(result?.is_active).toBe(true);
    expect(result?.created_at).toBeInstanceOf(Date);
    expect(result?.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent user ID', async () => {
    const result = await getRestaurantByUserId(99999);

    expect(result).toBeNull();
  });

  it('should return null for user with no restaurant association', async () => {
    // Create super admin user (no restaurant_id)
    const userResult = await db.insert(usersTable)
      .values({
        email: 'superadmin@example.com',
        password_hash: 'hashed_password',
        first_name: 'Super',
        last_name: 'Admin',
        role: 'SUPER_ADMIN',
        restaurant_id: null, // Super admin has no restaurant
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    const result = await getRestaurantByUserId(user.id);

    expect(result).toBeNull();
  });

  it('should return null for inactive user', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Active Restaurant',
        email: 'active@restaurant.com',
        is_active: true
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create inactive user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'inactive@example.com',
        password_hash: 'hashed_password',
        first_name: 'Inactive',
        last_name: 'User',
        role: 'STAFF',
        restaurant_id: restaurant.id,
        is_active: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    const result = await getRestaurantByUserId(user.id);

    expect(result).toBeNull();
  });

  it('should return null when restaurant is inactive', async () => {
    // Create inactive restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Inactive Restaurant',
        email: 'inactive@restaurant.com',
        is_active: false
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create active user associated with inactive restaurant
    const userResult = await db.insert(usersTable)
      .values({
        email: 'user@example.com',
        password_hash: 'hashed_password',
        first_name: 'Active',
        last_name: 'User',
        role: 'MANAGER',
        restaurant_id: restaurant.id,
        is_active: true
      })
      .returning()
      .execute();

    const user = userResult[0];

    const result = await getRestaurantByUserId(user.id);

    expect(result).toBeNull();
  });

  it('should handle user with restaurant having minimal fields', async () => {
    // Create restaurant with minimal fields
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Minimal User Restaurant',
        email: 'minimal-user@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'minimal-user@example.com',
        password_hash: 'hashed_password',
        first_name: 'Minimal',
        last_name: 'User',
        restaurant_id: restaurant.id
      })
      .returning()
      .execute();

    const user = userResult[0];

    const result = await getRestaurantByUserId(user.id);

    expect(result).toBeDefined();
    expect(result?.name).toEqual('Minimal User Restaurant');
    expect(result?.email).toEqual('minimal-user@restaurant.com');
    expect(result?.description).toBeNull();
    expect(result?.phone).toBeNull();
    expect(result?.address).toBeNull();
    expect(result?.logo_url).toBeNull();
    expect(result?.brand_color).toBeNull();
    expect(result?.is_active).toBe(true); // Default value
  });

  it('should verify database state after successful retrieval', async () => {
    // Create restaurant and user
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Verification Restaurant',
        email: 'verify@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    const userResult = await db.insert(usersTable)
      .values({
        email: 'verify@example.com',
        password_hash: 'hashed_password',
        first_name: 'Verify',
        last_name: 'User',
        restaurant_id: restaurant.id
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Get restaurant via handler
    const result = await getRestaurantByUserId(user.id);

    // Verify direct database query matches handler result
    const dbResult = await db.select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurant.id))
      .execute();

    expect(result).toBeDefined();
    expect(dbResult).toHaveLength(1);
    expect(result?.id).toEqual(dbResult[0].id);
    expect(result?.name).toEqual(dbResult[0].name);
    expect(result?.email).toEqual(dbResult[0].email);
  });
});