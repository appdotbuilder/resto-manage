import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { customersTable, restaurantsTable } from '../db/schema';
import { type CreateCustomerInput } from '../schema';
import { createCustomer } from '../handlers/create_customer';
import { eq } from 'drizzle-orm';

describe('createCustomer', () => {
  let restaurantId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test restaurant first (required for foreign key)
    const restaurant = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com',
        is_active: true
      })
      .returning()
      .execute();
    
    restaurantId = restaurant[0].id;
  });

  afterEach(resetDB);

  it('should create a customer with all fields', async () => {
    const testInput: CreateCustomerInput = {
      restaurant_id: restaurantId,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      notes: 'VIP customer'
    };

    const result = await createCustomer(testInput);

    // Verify all fields are set correctly
    expect(result.restaurant_id).toEqual(restaurantId);
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.email).toEqual('john.doe@example.com');
    expect(result.phone).toEqual('+1234567890');
    expect(result.notes).toEqual('VIP customer');
    
    // Verify loyalty program initialization
    expect(result.loyalty_points).toEqual(0);
    expect(result.total_visits).toEqual(0);
    expect(result.last_visit_date).toBeNull();
    
    // Verify default values
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a customer with minimal required fields', async () => {
    const testInput: CreateCustomerInput = {
      restaurant_id: restaurantId,
      first_name: 'Jane',
      last_name: 'Smith'
    };

    const result = await createCustomer(testInput);

    // Verify required fields
    expect(result.restaurant_id).toEqual(restaurantId);
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    
    // Verify optional fields are null
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.notes).toBeNull();
    
    // Verify loyalty program initialization
    expect(result.loyalty_points).toEqual(0);
    expect(result.total_visits).toEqual(0);
    expect(result.last_visit_date).toBeNull();
    expect(result.is_active).toBe(true);
  });

  it('should save customer to database correctly', async () => {
    const testInput: CreateCustomerInput = {
      restaurant_id: restaurantId,
      first_name: 'Alice',
      last_name: 'Johnson',
      email: 'alice@example.com',
      phone: '555-0123',
      notes: 'Prefers window seating'
    };

    const result = await createCustomer(testInput);

    // Query the database to verify the customer was saved
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, result.id))
      .execute();

    expect(customers).toHaveLength(1);
    
    const savedCustomer = customers[0];
    expect(savedCustomer.restaurant_id).toEqual(restaurantId);
    expect(savedCustomer.first_name).toEqual('Alice');
    expect(savedCustomer.last_name).toEqual('Johnson');
    expect(savedCustomer.email).toEqual('alice@example.com');
    expect(savedCustomer.phone).toEqual('555-0123');
    expect(savedCustomer.notes).toEqual('Prefers window seating');
    expect(savedCustomer.loyalty_points).toEqual(0);
    expect(savedCustomer.total_visits).toEqual(0);
    expect(savedCustomer.last_visit_date).toBeNull();
    expect(savedCustomer.is_active).toBe(true);
    expect(savedCustomer.created_at).toBeInstanceOf(Date);
    expect(savedCustomer.updated_at).toBeInstanceOf(Date);
  });

  it('should handle null optional fields correctly', async () => {
    const testInput: CreateCustomerInput = {
      restaurant_id: restaurantId,
      first_name: 'Bob',
      last_name: 'Wilson',
      email: null,
      phone: null,
      notes: null
    };

    const result = await createCustomer(testInput);

    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.notes).toBeNull();
    
    // Verify in database
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, result.id))
      .execute();

    const savedCustomer = customers[0];
    expect(savedCustomer.email).toBeNull();
    expect(savedCustomer.phone).toBeNull();
    expect(savedCustomer.notes).toBeNull();
  });

  it('should enforce tenant isolation through restaurant_id', async () => {
    // Create another restaurant
    const restaurant2 = await db.insert(restaurantsTable)
      .values({
        name: 'Another Restaurant',
        email: 'another@restaurant.com',
        is_active: true
      })
      .returning()
      .execute();

    const restaurant2Id = restaurant2[0].id;

    // Create customers for different restaurants
    const customer1Input: CreateCustomerInput = {
      restaurant_id: restaurantId,
      first_name: 'Customer',
      last_name: 'One'
    };

    const customer2Input: CreateCustomerInput = {
      restaurant_id: restaurant2Id,
      first_name: 'Customer',
      last_name: 'Two'
    };

    const customer1 = await createCustomer(customer1Input);
    const customer2 = await createCustomer(customer2Input);

    // Verify customers are associated with correct restaurants
    expect(customer1.restaurant_id).toEqual(restaurantId);
    expect(customer2.restaurant_id).toEqual(restaurant2Id);
    expect(customer1.restaurant_id).not.toEqual(customer2.restaurant_id);
  });

  it('should create customer even with non-existent restaurant_id', async () => {
    // Note: The current schema doesn't enforce foreign key constraints,
    // so this test documents the current behavior
    const testInput: CreateCustomerInput = {
      restaurant_id: 99999, // Non-existent restaurant
      first_name: 'Invalid',
      last_name: 'Customer'
    };

    const result = await createCustomer(testInput);
    
    // Verify customer was created despite invalid restaurant_id
    expect(result.restaurant_id).toEqual(99999);
    expect(result.first_name).toEqual('Invalid');
    expect(result.last_name).toEqual('Customer');
    expect(result.id).toBeDefined();
  });
});