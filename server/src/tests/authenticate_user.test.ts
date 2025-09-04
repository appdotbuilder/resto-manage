import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, restaurantsTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { authenticateUser } from '../handlers/authenticate_user';
import { createHash, randomBytes } from 'crypto';

// Helper function to create password hash (matching the handler's logic)
const createPasswordHash = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
};

// Test data
const testRestaurant = {
  name: 'Test Restaurant',
  email: 'test@restaurant.com'
};

const testPassword = 'testPassword123';

const testUser = {
  email: 'john@example.com',
  first_name: 'John',
  last_name: 'Doe',
  role: 'STAFF' as const,
  restaurant_id: null as number | null
};

const loginInput: LoginInput = {
  email: 'john@example.com',
  password: testPassword
};

describe('authenticateUser', () => {
  let hashedPassword: string;
  let restaurantId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create password hash for test user
    hashedPassword = createPasswordHash(testPassword);
    
    // Create test restaurant
    const restaurants = await db.insert(restaurantsTable)
      .values(testRestaurant)
      .returning()
      .execute();
    
    restaurantId = restaurants[0].id;
    
    // Create test user with restaurant reference
    await db.insert(usersTable)
      .values({
        ...testUser,
        password_hash: hashedPassword,
        restaurant_id: restaurantId
      })
      .execute();
  });
  
  afterEach(resetDB);

  it('should authenticate user with valid credentials', async () => {
    const result = await authenticateUser(loginInput);

    expect(result).toBeDefined();
    expect(result!.email).toEqual('john@example.com');
    expect(result!.first_name).toEqual('John');
    expect(result!.last_name).toEqual('Doe');
    expect(result!.role).toEqual('STAFF');
    expect(result!.is_active).toBe(true);
    expect(result!.restaurant_id).toEqual(restaurantId);
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.password_hash).toEqual(hashedPassword);
  });

  it('should return null for non-existent email', async () => {
    const invalidInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: testPassword
    };

    const result = await authenticateUser(invalidInput);
    expect(result).toBeNull();
  });

  it('should return null for incorrect password', async () => {
    const invalidInput: LoginInput = {
      email: 'john@example.com',
      password: 'wrongPassword'
    };

    const result = await authenticateUser(invalidInput);
    expect(result).toBeNull();
  });

  it('should return null for inactive user', async () => {
    // Create inactive user
    const inactiveHashedPassword = createPasswordHash(testPassword);
    const inactiveUser = {
      email: 'inactive@example.com',
      password_hash: inactiveHashedPassword,
      first_name: 'Inactive',
      last_name: 'User',
      role: 'STAFF' as const,
      is_active: false,
      restaurant_id: restaurantId
    };

    await db.insert(usersTable)
      .values(inactiveUser)
      .execute();

    const invalidInput: LoginInput = {
      email: 'inactive@example.com',
      password: testPassword
    };

    const result = await authenticateUser(invalidInput);
    expect(result).toBeNull();
  });

  it('should authenticate super admin without restaurant', async () => {
    // Create super admin user without restaurant
    const adminHashedPassword = createPasswordHash(testPassword);
    const superAdminUser = {
      email: 'admin@system.com',
      password_hash: adminHashedPassword,
      first_name: 'Super',
      last_name: 'Admin',
      role: 'SUPER_ADMIN' as const,
      restaurant_id: null
    };

    await db.insert(usersTable)
      .values(superAdminUser)
      .execute();

    const adminInput: LoginInput = {
      email: 'admin@system.com',
      password: testPassword
    };

    const result = await authenticateUser(adminInput);

    expect(result).toBeDefined();
    expect(result!.email).toEqual('admin@system.com');
    expect(result!.role).toEqual('SUPER_ADMIN');
    expect(result!.restaurant_id).toBeNull();
    expect(result!.is_active).toBe(true);
  });

  it('should authenticate restaurant owner', async () => {
    // Create restaurant owner
    const ownerHashedPassword = createPasswordHash(testPassword);
    const ownerUser = {
      email: 'owner@restaurant.com',
      password_hash: ownerHashedPassword,
      first_name: 'Restaurant',
      last_name: 'Owner',
      role: 'RESTAURANT_OWNER' as const,
      restaurant_id: restaurantId
    };

    await db.insert(usersTable)
      .values(ownerUser)
      .execute();

    const ownerInput: LoginInput = {
      email: 'owner@restaurant.com',
      password: testPassword
    };

    const result = await authenticateUser(ownerInput);

    expect(result).toBeDefined();
    expect(result!.email).toEqual('owner@restaurant.com');
    expect(result!.role).toEqual('RESTAURANT_OWNER');
    expect(result!.restaurant_id).toEqual(restaurantId);
    expect(result!.is_active).toBe(true);
  });

  it('should handle case-sensitive email authentication', async () => {
    const uppercaseInput: LoginInput = {
      email: 'JOHN@EXAMPLE.COM',
      password: testPassword
    };

    const result = await authenticateUser(uppercaseInput);
    expect(result).toBeNull(); // Email should be case-sensitive
  });

  it('should handle empty password gracefully', async () => {
    const emptyPasswordInput: LoginInput = {
      email: 'john@example.com',
      password: ''
    };

    const result = await authenticateUser(emptyPasswordInput);
    expect(result).toBeNull();
  });

  it('should return null for malformed password hash', async () => {
    // Create user with malformed password hash
    const malformedUser = {
      email: 'malformed@example.com',
      password_hash: 'malformed_hash_without_salt',
      first_name: 'Malformed',
      last_name: 'User',
      role: 'STAFF' as const,
      restaurant_id: restaurantId
    };

    await db.insert(usersTable)
      .values(malformedUser)
      .execute();

    const malformedInput: LoginInput = {
      email: 'malformed@example.com',
      password: testPassword
    };

    const result = await authenticateUser(malformedInput);
    expect(result).toBeNull();
  });

  it('should authenticate manager role correctly', async () => {
    // Create manager user
    const managerHashedPassword = createPasswordHash(testPassword);
    const managerUser = {
      email: 'manager@restaurant.com',
      password_hash: managerHashedPassword,
      first_name: 'Restaurant',
      last_name: 'Manager',
      role: 'MANAGER' as const,
      restaurant_id: restaurantId
    };

    await db.insert(usersTable)
      .values(managerUser)
      .execute();

    const managerInput: LoginInput = {
      email: 'manager@restaurant.com',
      password: testPassword
    };

    const result = await authenticateUser(managerInput);

    expect(result).toBeDefined();
    expect(result!.email).toEqual('manager@restaurant.com');
    expect(result!.role).toEqual('MANAGER');
    expect(result!.restaurant_id).toEqual(restaurantId);
    expect(result!.is_active).toBe(true);
  });
});