import { db } from '../db';
import { customersTable } from '../db/schema';
import { type GetCustomersByRestaurantInput, type Customer } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export const getCustomersByRestaurant = async (input: GetCustomersByRestaurantInput): Promise<Customer[]> => {
  try {
    // Apply pagination defaults
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    // Build complete query in one chain
    const results = await db.select()
      .from(customersTable)
      .where(eq(customersTable.restaurant_id, input.restaurant_id))
      .orderBy(desc(customersTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    // Return customers with proper type conversion
    return results.map(customer => ({
      ...customer,
      created_at: new Date(customer.created_at),
      updated_at: new Date(customer.updated_at),
      last_visit_date: customer.last_visit_date ? new Date(customer.last_visit_date) : null
    }));
  } catch (error) {
    console.error('Failed to fetch customers by restaurant:', error);
    throw error;
  }
};

export const getCustomer = async (customerId: number, restaurantId: number): Promise<Customer | null> => {
  try {
    const results = await db.select()
      .from(customersTable)
      .where(
        and(
          eq(customersTable.id, customerId),
          eq(customersTable.restaurant_id, restaurantId)
        )
      )
      .execute();

    if (results.length === 0) {
      return null;
    }

    const customer = results[0];
    return {
      ...customer,
      created_at: new Date(customer.created_at),
      updated_at: new Date(customer.updated_at),
      last_visit_date: customer.last_visit_date ? new Date(customer.last_visit_date) : null
    };
  } catch (error) {
    console.error('Failed to fetch customer:', error);
    throw error;
  }
};