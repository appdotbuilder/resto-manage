import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { restaurantsTable, customersTable } from '../db/schema';
import { type GetCustomersByRestaurantInput } from '../schema';
import { getCustomersByRestaurant, getCustomer } from '../handlers/get_customers';

describe('getCustomersByRestaurant', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch customers for a specific restaurant', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com',
        is_active: true
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create test customers
    await db.insert(customersTable)
      .values([
        {
          restaurant_id: restaurant.id,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
          loyalty_points: 100,
          total_visits: 5
        },
        {
          restaurant_id: restaurant.id,
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          loyalty_points: 50,
          total_visits: 2
        }
      ])
      .execute();

    const input: GetCustomersByRestaurantInput = {
      restaurant_id: restaurant.id
    };

    const customers = await getCustomersByRestaurant(input);

    expect(customers).toHaveLength(2);
    expect(customers[0].first_name).toBeDefined();
    expect(customers[0].restaurant_id).toEqual(restaurant.id);
    expect(customers[0].created_at).toBeInstanceOf(Date);
    expect(customers[0].updated_at).toBeInstanceOf(Date);
    expect(typeof customers[0].loyalty_points).toBe('number');
    expect(typeof customers[0].total_visits).toBe('number');
  });

  it('should apply pagination correctly', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create multiple customers
    const customerData = Array.from({ length: 15 }, (_, i) => ({
      restaurant_id: restaurant.id,
      first_name: `Customer${i + 1}`,
      last_name: 'Test',
      email: `customer${i + 1}@example.com`,
      loyalty_points: (i + 1) * 10,
      total_visits: i + 1
    }));

    await db.insert(customersTable)
      .values(customerData)
      .execute();

    // Test with limit
    const limitedInput: GetCustomersByRestaurantInput = {
      restaurant_id: restaurant.id,
      limit: 5
    };

    const limitedCustomers = await getCustomersByRestaurant(limitedInput);
    expect(limitedCustomers).toHaveLength(5);

    // Test with offset
    const offsetInput: GetCustomersByRestaurantInput = {
      restaurant_id: restaurant.id,
      limit: 5,
      offset: 5
    };

    const offsetCustomers = await getCustomersByRestaurant(offsetInput);
    expect(offsetCustomers).toHaveLength(5);

    // Verify different results
    expect(limitedCustomers[0].id).not.toEqual(offsetCustomers[0].id);
  });

  it('should return empty array for restaurant with no customers', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Empty Restaurant',
        email: 'empty@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    const input: GetCustomersByRestaurantInput = {
      restaurant_id: restaurant.id
    };

    const customers = await getCustomersByRestaurant(input);
    expect(customers).toHaveLength(0);
  });

  it('should isolate customers by restaurant (tenant isolation)', async () => {
    // Create two test restaurants
    const restaurant1Result = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 1',
        email: 'restaurant1@example.com'
      })
      .returning()
      .execute();

    const restaurant2Result = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 2',
        email: 'restaurant2@example.com'
      })
      .returning()
      .execute();

    const restaurant1 = restaurant1Result[0];
    const restaurant2 = restaurant2Result[0];

    // Create customers for both restaurants
    await db.insert(customersTable)
      .values([
        {
          restaurant_id: restaurant1.id,
          first_name: 'Restaurant1',
          last_name: 'Customer1',
          email: 'r1c1@example.com'
        },
        {
          restaurant_id: restaurant1.id,
          first_name: 'Restaurant1',
          last_name: 'Customer2',
          email: 'r1c2@example.com'
        },
        {
          restaurant_id: restaurant2.id,
          first_name: 'Restaurant2',
          last_name: 'Customer1',
          email: 'r2c1@example.com'
        }
      ])
      .execute();

    // Query customers for restaurant 1
    const restaurant1Customers = await getCustomersByRestaurant({
      restaurant_id: restaurant1.id
    });

    // Query customers for restaurant 2
    const restaurant2Customers = await getCustomersByRestaurant({
      restaurant_id: restaurant2.id
    });

    expect(restaurant1Customers).toHaveLength(2);
    expect(restaurant2Customers).toHaveLength(1);

    // Verify tenant isolation
    restaurant1Customers.forEach(customer => {
      expect(customer.restaurant_id).toEqual(restaurant1.id);
    });

    restaurant2Customers.forEach(customer => {
      expect(customer.restaurant_id).toEqual(restaurant2.id);
    });
  });

  it('should handle customers with null optional fields', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create customer with minimal required fields
    await db.insert(customersTable)
      .values({
        restaurant_id: restaurant.id,
        first_name: 'Minimal',
        last_name: 'Customer'
        // email, phone, notes are null
        // last_visit_date is null
      })
      .execute();

    const customers = await getCustomersByRestaurant({
      restaurant_id: restaurant.id
    });

    expect(customers).toHaveLength(1);
    expect(customers[0].email).toBeNull();
    expect(customers[0].phone).toBeNull();
    expect(customers[0].notes).toBeNull();
    expect(customers[0].last_visit_date).toBeNull();
    expect(customers[0].loyalty_points).toBe(0); // Default value
    expect(customers[0].total_visits).toBe(0); // Default value
    expect(customers[0].is_active).toBe(true); // Default value
  });
});

describe('getCustomer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch a specific customer by ID', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    // Create test customer
    const customerResult = await db.insert(customersTable)
      .values({
        restaurant_id: restaurant.id,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        loyalty_points: 150,
        total_visits: 10,
        notes: 'VIP customer'
      })
      .returning()
      .execute();

    const insertedCustomer = customerResult[0];

    const customer = await getCustomer(insertedCustomer.id, restaurant.id);

    expect(customer).not.toBeNull();
    expect(customer!.id).toEqual(insertedCustomer.id);
    expect(customer!.first_name).toEqual('John');
    expect(customer!.last_name).toEqual('Doe');
    expect(customer!.email).toEqual('john@example.com');
    expect(customer!.phone).toEqual('123-456-7890');
    expect(customer!.loyalty_points).toBe(150);
    expect(customer!.total_visits).toBe(10);
    expect(customer!.notes).toEqual('VIP customer');
    expect(customer!.restaurant_id).toEqual(restaurant.id);
    expect(customer!.created_at).toBeInstanceOf(Date);
    expect(customer!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent customer', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    const customer = await getCustomer(999, restaurant.id);
    expect(customer).toBeNull();
  });

  it('should enforce tenant isolation (customer from different restaurant)', async () => {
    // Create two test restaurants
    const restaurant1Result = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 1',
        email: 'restaurant1@example.com'
      })
      .returning()
      .execute();

    const restaurant2Result = await db.insert(restaurantsTable)
      .values({
        name: 'Restaurant 2',
        email: 'restaurant2@example.com'
      })
      .returning()
      .execute();

    const restaurant1 = restaurant1Result[0];
    const restaurant2 = restaurant2Result[0];

    // Create customer in restaurant 1
    const customerResult = await db.insert(customersTable)
      .values({
        restaurant_id: restaurant1.id,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      })
      .returning()
      .execute();

    const customer = customerResult[0];

    // Try to fetch customer from restaurant 1 using restaurant 2 ID
    const result = await getCustomer(customer.id, restaurant2.id);
    expect(result).toBeNull();

    // Verify customer can be fetched with correct restaurant ID
    const correctResult = await getCustomer(customer.id, restaurant1.id);
    expect(correctResult).not.toBeNull();
    expect(correctResult!.id).toEqual(customer.id);
  });

  it('should handle customer with last_visit_date', async () => {
    // Create test restaurant
    const restaurantResult = await db.insert(restaurantsTable)
      .values({
        name: 'Test Restaurant',
        email: 'test@restaurant.com'
      })
      .returning()
      .execute();

    const restaurant = restaurantResult[0];

    const visitDate = new Date('2023-12-25T10:00:00Z');

    // Create customer with last_visit_date
    const customerResult = await db.insert(customersTable)
      .values({
        restaurant_id: restaurant.id,
        first_name: 'Jane',
        last_name: 'Smith',
        last_visit_date: visitDate
      })
      .returning()
      .execute();

    const insertedCustomer = customerResult[0];

    const customer = await getCustomer(insertedCustomer.id, restaurant.id);

    expect(customer).not.toBeNull();
    expect(customer!.last_visit_date).toBeInstanceOf(Date);
    expect(customer!.last_visit_date!.getTime()).toEqual(visitDate.getTime());
  });
});