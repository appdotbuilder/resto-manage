import { db } from '../db';
import { customersTable } from '../db/schema';
import { type UpdateCustomerInput, type Customer } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateCustomer = async (input: UpdateCustomerInput, restaurantId: number): Promise<Customer> => {
  try {
    // First, verify that the customer exists and belongs to the restaurant (tenant isolation)
    const existingCustomer = await db.select()
      .from(customersTable)
      .where(and(
        eq(customersTable.id, input.id),
        eq(customersTable.restaurant_id, restaurantId)
      ))
      .execute();

    if (existingCustomer.length === 0) {
      throw new Error('Customer not found or does not belong to this restaurant');
    }

    // Build update object only with provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.first_name !== undefined) {
      updateData.first_name = input.first_name;
    }
    if (input.last_name !== undefined) {
      updateData.last_name = input.last_name;
    }
    if (input.email !== undefined) {
      updateData.email = input.email;
    }
    if (input.phone !== undefined) {
      updateData.phone = input.phone;
    }
    if (input.loyalty_points !== undefined) {
      updateData.loyalty_points = input.loyalty_points;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Update customer record
    const result = await db.update(customersTable)
      .set(updateData)
      .where(and(
        eq(customersTable.id, input.id),
        eq(customersTable.restaurant_id, restaurantId)
      ))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update customer');
    }

    return result[0];
  } catch (error) {
    console.error('Customer update failed:', error);
    throw error;
  }
};