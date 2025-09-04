import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { restaurantsTable, customersTable } from '../db/schema';
import { type UpdateCustomerInput } from '../schema';
import { updateCustomer } from '../handlers/update_customer';
import { eq } from 'drizzle-orm';

describe('updateCustomer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testRestaurantId: number;
  let testCustomerId: number;
  let otherRestaurantId: number;

  beforeEach(async () => {
    // Create test restaurant
    const restaurant = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com',
        is_active: true
      })
      .returning()
      .execute();
    testRestaurantId = restaurant[0].id;

    // Create another restaurant for tenant isolation tests
    const otherRestaurant = await db.insert(restaurantsTable)
      .values({
        name: 'Other Restaurant',
        email: 'other@restaurant.com',
        is_active: true
      })
      .returning()
      .execute();
    otherRestaurantId = otherRestaurant[0].id;

    // Create test customer
    const customer = await db.insert(customersTable)
      .values({
        restaurant_id: testRestaurantId,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        loyalty_points: 100,
        notes: 'Regular customer',
        is_active: true
      })
      .returning()
      .execute();
    testCustomerId = customer[0].id;
  });

  it('should update customer basic information', async () => {
    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      phone: '555-5678'
    };

    const result = await updateCustomer(updateInput, testRestaurantId);

    expect(result.id).toEqual(testCustomerId);
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.email).toEqual('jane@example.com');
    expect(result.phone).toEqual('555-5678');
    expect(result.restaurant_id).toEqual(testRestaurantId);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Unchanged fields should remain the same
    expect(result.loyalty_points).toEqual(100);
    expect(result.notes).toEqual('Regular customer');
    expect(result.is_active).toEqual(true);
  });

  it('should update loyalty points and notes', async () => {
    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      loyalty_points: 150,
      notes: 'VIP customer'
    };

    const result = await updateCustomer(updateInput, testRestaurantId);

    expect(result.loyalty_points).toEqual(150);
    expect(result.notes).toEqual('VIP customer');
    
    // Unchanged fields should remain the same
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.email).toEqual('john@example.com');
    expect(result.phone).toEqual('555-1234');
  });

  it('should update customer active status', async () => {
    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      is_active: false
    };

    const result = await updateCustomer(updateInput, testRestaurantId);

    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle nullable fields properly', async () => {
    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      email: null,
      phone: null,
      notes: null
    };

    const result = await updateCustomer(updateInput, testRestaurantId);

    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('should update customer in database', async () => {
    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      first_name: 'UpdatedName',
      loyalty_points: 200
    };

    await updateCustomer(updateInput, testRestaurantId);

    // Verify in database
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, testCustomerId))
      .execute();

    expect(customers).toHaveLength(1);
    expect(customers[0].first_name).toEqual('UpdatedName');
    expect(customers[0].loyalty_points).toEqual(200);
    expect(customers[0].updated_at).toBeInstanceOf(Date);
  });

  it('should enforce tenant isolation - cannot update customer from different restaurant', async () => {
    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      first_name: 'Hacker'
    };

    // Try to update customer from a different restaurant
    await expect(updateCustomer(updateInput, otherRestaurantId))
      .rejects.toThrow(/Customer not found or does not belong to this restaurant/i);
  });

  it('should throw error for non-existent customer', async () => {
    const updateInput: UpdateCustomerInput = {
      id: 99999, // Non-existent customer ID
      first_name: 'NonExistent'
    };

    await expect(updateCustomer(updateInput, testRestaurantId))
      .rejects.toThrow(/Customer not found or does not belong to this restaurant/i);
  });

  it('should handle partial updates correctly', async () => {
    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      first_name: 'PartialUpdate'
      // Only updating first_name, everything else should remain unchanged
    };

    const result = await updateCustomer(updateInput, testRestaurantId);

    expect(result.first_name).toEqual('PartialUpdate');
    expect(result.last_name).toEqual('Doe'); // Should remain unchanged
    expect(result.email).toEqual('john@example.com'); // Should remain unchanged
    expect(result.phone).toEqual('555-1234'); // Should remain unchanged
    expect(result.loyalty_points).toEqual(100); // Should remain unchanged
    expect(result.notes).toEqual('Regular customer'); // Should remain unchanged
    expect(result.is_active).toEqual(true); // Should remain unchanged
  });

  it('should update timestamp on every update', async () => {
    // Get original timestamp
    const originalCustomer = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, testCustomerId))
      .execute();
    
    const originalUpdatedAt = originalCustomer[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateCustomerInput = {
      id: testCustomerId,
      first_name: 'TimestampTest'
    };

    const result = await updateCustomer(updateInput, testRestaurantId);

    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});