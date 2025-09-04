import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable } from '../db/schema';
import { type UpdateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testRestaurantId: number;
  let testUserId: number;

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

    // Create a test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'STAFF',
        restaurant_id: testRestaurantId,
        is_active: true
      })
      .returning()
      .execute();
    
    testUserId = user[0].id;
  });

  it('should update user email', async () => {
    const input: UpdateUserInput = {
      id: testUserId,
      email: 'updated@example.com'
    };

    const result = await updateUser(input);

    expect(result.id).toBe(testUserId);
    expect(result.email).toBe('updated@example.com');
    expect(result.first_name).toBe('John'); // Should remain unchanged
    expect(result.last_name).toBe('Doe'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify database was updated
    const dbUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();
    
    expect(dbUser[0].email).toBe('updated@example.com');
  });

  it('should update user name fields', async () => {
    const input: UpdateUserInput = {
      id: testUserId,
      first_name: 'Jane',
      last_name: 'Smith'
    };

    const result = await updateUser(input);

    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Smith');
    expect(result.email).toBe('test@example.com'); // Should remain unchanged
  });

  it('should update user role', async () => {
    const input: UpdateUserInput = {
      id: testUserId,
      role: 'MANAGER'
    };

    const result = await updateUser(input);

    expect(result.role).toBe('MANAGER');
    expect(result.first_name).toBe('John'); // Should remain unchanged
  });

  it('should update user restaurant_id', async () => {
    // Create another restaurant
    const anotherRestaurant = await db.insert(restaurantsTable)
      .values({
        name: 'Another Restaurant',
        email: 'another@restaurant.com'
      })
      .returning()
      .execute();

    const input: UpdateUserInput = {
      id: testUserId,
      restaurant_id: anotherRestaurant[0].id
    };

    const result = await updateUser(input);

    expect(result.restaurant_id).toBe(anotherRestaurant[0].id);
  });

  it('should set restaurant_id to null for super admin', async () => {
    const input: UpdateUserInput = {
      id: testUserId,
      role: 'SUPER_ADMIN',
      restaurant_id: null
    };

    const result = await updateUser(input);

    expect(result.role).toBe('SUPER_ADMIN');
    expect(result.restaurant_id).toBeNull();
  });

  it('should update user active status', async () => {
    const input: UpdateUserInput = {
      id: testUserId,
      is_active: false
    };

    const result = await updateUser(input);

    expect(result.is_active).toBe(false);
    expect(result.first_name).toBe('John'); // Should remain unchanged
  });

  it('should update multiple fields simultaneously', async () => {
    const input: UpdateUserInput = {
      id: testUserId,
      email: 'multupdate@example.com',
      first_name: 'Multi',
      last_name: 'Update',
      role: 'MANAGER',
      is_active: false
    };

    const result = await updateUser(input);

    expect(result.email).toBe('multupdate@example.com');
    expect(result.first_name).toBe('Multi');
    expect(result.last_name).toBe('Update');
    expect(result.role).toBe('MANAGER');
    expect(result.is_active).toBe(false);
    expect(result.restaurant_id).toBe(testRestaurantId); // Should remain unchanged
  });

  it('should update the updated_at timestamp', async () => {
    const originalUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    const originalUpdatedAt = originalUser[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: UpdateUserInput = {
      id: testUserId,
      first_name: 'Updated'
    };

    const result = await updateUser(input);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error when user does not exist', async () => {
    const input: UpdateUserInput = {
      id: 99999, // Non-existent ID
      first_name: 'Should Fail'
    };

    expect(updateUser(input)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should preserve existing fields when only updating some fields', async () => {
    // Get original user data
    const originalUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    const input: UpdateUserInput = {
      id: testUserId,
      first_name: 'NewFirstName'
    };

    const result = await updateUser(input);

    // Check that only first_name changed
    expect(result.first_name).toBe('NewFirstName');
    expect(result.last_name).toBe(originalUser[0].last_name);
    expect(result.email).toBe(originalUser[0].email);
    expect(result.role).toBe(originalUser[0].role);
    expect(result.restaurant_id).toBe(originalUser[0].restaurant_id);
    expect(result.is_active).toBe(originalUser[0].is_active);
    expect(result.password_hash).toBe(originalUser[0].password_hash);
  });

  it('should handle edge case of updating with same values', async () => {
    const input: UpdateUserInput = {
      id: testUserId,
      email: 'test@example.com', // Same as original
      first_name: 'John', // Same as original
      role: 'STAFF' // Same as original
    };

    const result = await updateUser(input);

    expect(result.email).toBe('test@example.com');
    expect(result.first_name).toBe('John');
    expect(result.role).toBe('STAFF');
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});