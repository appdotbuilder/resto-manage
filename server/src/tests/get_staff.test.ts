import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable } from '../db/schema';
import { type GetStaffByRestaurantInput } from '../schema';
import { getStaffByRestaurant, getStaffMember } from '../handlers/get_staff';

describe('getStaffByRestaurant', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch staff members for a specific restaurant', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    // Create staff members for the restaurant
    await db.insert(usersTable)
      .values([
        {
          email: 'staff1@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Doe',
          role: 'STAFF',
          restaurant_id: restaurant.id
        },
        {
          email: 'manager@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Manager',
          role: 'MANAGER',
          restaurant_id: restaurant.id
        },
        {
          email: 'owner@test.com',
          password_hash: 'hash3',
          first_name: 'Bob',
          last_name: 'Owner',
          role: 'RESTAURANT_OWNER',
          restaurant_id: restaurant.id
        }
      ])
      .execute();

    const input: GetStaffByRestaurantInput = {
      restaurant_id: restaurant.id
    };

    const result = await getStaffByRestaurant(input);

    expect(result).toHaveLength(3);
    expect(result[0].restaurant_id).toBe(restaurant.id);
    expect(result[1].restaurant_id).toBe(restaurant.id);
    expect(result[2].restaurant_id).toBe(restaurant.id);
    
    // Verify all roles are present
    const roles = result.map(user => user.role).sort();
    expect(roles).toEqual(['MANAGER', 'RESTAURANT_OWNER', 'STAFF']);
  });

  it('should exclude super admins from staff list', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    // Create users including super admin
    await db.insert(usersTable)
      .values([
        {
          email: 'staff@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Staff',
          role: 'STAFF',
          restaurant_id: restaurant.id
        },
        {
          email: 'superadmin@test.com',
          password_hash: 'hash2',
          first_name: 'Super',
          last_name: 'Admin',
          role: 'SUPER_ADMIN',
          restaurant_id: null // Super admins don't belong to restaurants
        }
      ])
      .execute();

    const input: GetStaffByRestaurantInput = {
      restaurant_id: restaurant.id
    };

    const result = await getStaffByRestaurant(input);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('STAFF');
    expect(result[0].email).toBe('staff@test.com');
  });

  it('should respect pagination limits', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    // Create multiple staff members
    const staffMembers = Array.from({ length: 5 }, (_, i) => ({
      email: `staff${i + 1}@test.com`,
      password_hash: `hash${i + 1}`,
      first_name: `Staff${i + 1}`,
      last_name: 'User',
      role: 'STAFF' as const,
      restaurant_id: restaurant.id
    }));

    await db.insert(usersTable)
      .values(staffMembers)
      .execute();

    const input: GetStaffByRestaurantInput = {
      restaurant_id: restaurant.id,
      limit: 3,
      offset: 0
    };

    const result = await getStaffByRestaurant(input);

    expect(result).toHaveLength(3);
    result.forEach(user => {
      expect(user.restaurant_id).toBe(restaurant.id);
      expect(user.role).toBe('STAFF');
    });
  });

  it('should handle pagination offset correctly', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    // Create staff members
    await db.insert(usersTable)
      .values([
        {
          email: 'staff1@test.com',
          password_hash: 'hash1',
          first_name: 'Staff1',
          last_name: 'User',
          role: 'STAFF',
          restaurant_id: restaurant.id
        },
        {
          email: 'staff2@test.com',
          password_hash: 'hash2',
          first_name: 'Staff2',
          last_name: 'User',
          role: 'STAFF',
          restaurant_id: restaurant.id
        }
      ])
      .execute();

    const input: GetStaffByRestaurantInput = {
      restaurant_id: restaurant.id,
      limit: 1,
      offset: 1
    };

    const result = await getStaffByRestaurant(input);

    expect(result).toHaveLength(1);
    expect(result[0].restaurant_id).toBe(restaurant.id);
  });

  it('should return empty array when no staff found', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const input: GetStaffByRestaurantInput = {
      restaurant_id: restaurant.id
    };

    const result = await getStaffByRestaurant(input);

    expect(result).toHaveLength(0);
  });

  it('should enforce tenant isolation', async () => {
    // Create two restaurants
    const [restaurant1] = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 1',
        email: 'restaurant1@test.com'
      })
      .returning()
      .execute();

    const [restaurant2] = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 2',
        email: 'restaurant2@test.com'
      })
      .returning()
      .execute();

    // Create staff for both restaurants
    await db.insert(usersTable)
      .values([
        {
          email: 'staff1@test.com',
          password_hash: 'hash1',
          first_name: 'Staff1',
          last_name: 'User',
          role: 'STAFF',
          restaurant_id: restaurant1.id
        },
        {
          email: 'staff2@test.com',
          password_hash: 'hash2',
          first_name: 'Staff2',
          last_name: 'User',
          role: 'STAFF',
          restaurant_id: restaurant2.id
        }
      ])
      .execute();

    const input: GetStaffByRestaurantInput = {
      restaurant_id: restaurant1.id
    };

    const result = await getStaffByRestaurant(input);

    expect(result).toHaveLength(1);
    expect(result[0].restaurant_id).toBe(restaurant1.id);
    expect(result[0].email).toBe('staff1@test.com');
  });
});

describe('getStaffMember', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch a specific staff member by ID', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    // Create staff member
    const [staff] = await db.insert(usersTable)
      .values({
        email: 'staff@test.com',
        password_hash: 'hash1',
        first_name: 'John',
        last_name: 'Doe',
        role: 'STAFF',
        restaurant_id: restaurant.id
      })
      .returning()
      .execute();

    const result = await getStaffMember(staff.id, restaurant.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(staff.id);
    expect(result!.email).toBe('staff@test.com');
    expect(result!.first_name).toBe('John');
    expect(result!.restaurant_id).toBe(restaurant.id);
    expect(result!.role).toBe('STAFF');
  });

  it('should return null when staff member not found', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const result = await getStaffMember(999, restaurant.id);

    expect(result).toBeNull();
  });

  it('should enforce tenant isolation for individual staff lookup', async () => {
    // Create two restaurants
    const [restaurant1] = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 1',
        email: 'restaurant1@test.com'
      })
      .returning()
      .execute();

    const [restaurant2] = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 2',
        email: 'restaurant2@test.com'
      })
      .returning()
      .execute();

    // Create staff member in restaurant1
    const [staff] = await db.insert(usersTable)
      .values({
        email: 'staff@test.com',
        password_hash: 'hash1',
        first_name: 'John',
        last_name: 'Doe',
        role: 'STAFF',
        restaurant_id: restaurant1.id
      })
      .returning()
      .execute();

    // Try to fetch staff from restaurant2 (should fail due to tenant isolation)
    const result = await getStaffMember(staff.id, restaurant2.id);

    expect(result).toBeNull();
  });

  it('should exclude super admins from individual staff lookup', async () => {
    // Create super admin
    const [superAdmin] = await db.insert(usersTable)
      .values({
        email: 'superadmin@test.com',
        password_hash: 'hash1',
        first_name: 'Super',
        last_name: 'Admin',
        role: 'SUPER_ADMIN',
        restaurant_id: null
      })
      .returning()
      .execute();

    // Try to fetch super admin as staff member
    const result = await getStaffMember(superAdmin.id, 1);

    expect(result).toBeNull();
  });

  it('should handle all staff role types', async () => {
    // Create test restaurant
    const [restaurant] = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    // Create different types of staff members
    const [manager] = await db.insert(usersTable)
      .values({
        email: 'manager@test.com',
        password_hash: 'hash1',
        first_name: 'Jane',
        last_name: 'Manager',
        role: 'MANAGER',
        restaurant_id: restaurant.id
      })
      .returning()
      .execute();

    const [owner] = await db.insert(usersTable)
      .values({
        email: 'owner@test.com',
        password_hash: 'hash2',
        first_name: 'Bob',
        last_name: 'Owner',
        role: 'RESTAURANT_OWNER',
        restaurant_id: restaurant.id
      })
      .returning()
      .execute();

    // Test manager lookup
    const managerResult = await getStaffMember(manager.id, restaurant.id);
    expect(managerResult).not.toBeNull();
    expect(managerResult!.role).toBe('MANAGER');

    // Test owner lookup
    const ownerResult = await getStaffMember(owner.id, restaurant.id);
    expect(ownerResult).not.toBeNull();
    expect(ownerResult!.role).toBe('RESTAURANT_OWNER');
  });
});