import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Test input data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'STAFF',
  restaurant_id: 1
};

const superAdminInput: CreateUserInput = {
  email: 'admin@example.com',
  password: 'adminpass123',
  first_name: 'Super',
  last_name: 'Admin',
  role: 'SUPER_ADMIN'
  // No restaurant_id for super admin
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    // Create a restaurant first for foreign key constraint
    await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'restaurant@test.com',
        is_active: true
      })
      .execute();

    const result = await createUser(testUserInput);

    // Verify basic fields
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('STAFF');
    expect(result.restaurant_id).toEqual(1);
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify password is hashed (not plain text)
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123');
    expect(result.password_hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
  });

  it('should hash the password correctly', async () => {
    // Create a restaurant first
    await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'restaurant@test.com',
        is_active: true
      })
      .execute();

    const result = await createUser(testUserInput);

    // Verify the password hash format (hash:salt)
    expect(result.password_hash).toContain(':');
    const [hash, salt] = result.password_hash.split(':');
    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash.length).toEqual(64); // SHA256 hex string length
    expect(salt.length).toEqual(32); // 16 bytes as hex string

    // Verify the password hash can be verified
    const expectedHash = createHash('sha256').update('password123' + salt).digest('hex');
    expect(hash).toEqual(expectedHash);

    // Verify wrong password produces different hash
    const wrongHash = createHash('sha256').update('wrongpassword' + salt).digest('hex');
    expect(hash).not.toEqual(wrongHash);
  });

  it('should save user to database', async () => {
    // Create a restaurant first
    await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'restaurant@test.com',
        is_active: true
      })
      .execute();

    const result = await createUser(testUserInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.first_name).toEqual('John');
    expect(savedUser.last_name).toEqual('Doe');
    expect(savedUser.role).toEqual('STAFF');
    expect(savedUser.restaurant_id).toEqual(1);
    expect(savedUser.is_active).toEqual(true);
  });

  it('should create super admin without restaurant_id', async () => {
    const result = await createUser(superAdminInput);

    expect(result.email).toEqual('admin@example.com');
    expect(result.first_name).toEqual('Super');
    expect(result.last_name).toEqual('Admin');
    expect(result.role).toEqual('SUPER_ADMIN');
    expect(result.restaurant_id).toBeNull();
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
  });

  it('should default to STAFF role when not provided', async () => {
    // Create a restaurant first
    await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'restaurant@test.com',
        is_active: true
      })
      .execute();

    const inputWithoutRole: CreateUserInput = {
      email: 'staff@example.com',
      password: 'staffpass123',
      first_name: 'Default',
      last_name: 'Staff',
      restaurant_id: 1
    };

    const result = await createUser(inputWithoutRole);

    expect(result.role).toEqual('STAFF');
  });

  it('should handle all user roles correctly', async () => {
    // Create a restaurant first
    await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'restaurant@test.com',
        is_active: true
      })
      .execute();

    const roles = ['RESTAURANT_OWNER', 'MANAGER', 'STAFF'] as const;

    for (const role of roles) {
      const input: CreateUserInput = {
        email: `${role.toLowerCase()}@example.com`,
        password: 'password123',
        first_name: 'Test',
        last_name: role,
        role: role,
        restaurant_id: 1
      };

      const result = await createUser(input);
      expect(result.role).toEqual(role);
    }
  });

  it('should allow user creation with non-existent restaurant_id', async () => {
    // Note: The schema doesn't define explicit foreign key constraints
    // so this test verifies the current behavior rather than strict referential integrity
    const inputWithInvalidRestaurant: CreateUserInput = {
      email: 'invalid@example.com',
      password: 'password123',
      first_name: 'John',
      last_name: 'Doe',
      role: 'STAFF',
      restaurant_id: 999 // Non-existent restaurant
    };

    const result = await createUser(inputWithInvalidRestaurant);

    expect(result.restaurant_id).toEqual(999);
    expect(result.email).toEqual('invalid@example.com');
    expect(result.id).toBeDefined();
  });

  it('should fail when email is not unique', async () => {
    // Create a restaurant first
    await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'restaurant@test.com',
        is_active: true
      })
      .execute();

    // Create first user
    await createUser(testUserInput);

    // Try to create second user with same email
    const duplicateEmailInput: CreateUserInput = {
      email: 'test@example.com', // Same email
      password: 'differentpass',
      first_name: 'Jane',
      last_name: 'Smith',
      role: 'MANAGER',
      restaurant_id: 1
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow();
  });
});