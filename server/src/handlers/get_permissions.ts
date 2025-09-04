import { db } from '../db';
import { permissionsTable, rolePermissionsTable } from '../db/schema';
import { type Permission, type RolePermission, type UserRole } from '../schema';
import { eq, and } from 'drizzle-orm';

export const getPermissionsByRole = async (role: UserRole): Promise<Permission[]> => {
  try {
    // Join role permissions with permissions table to get full permission details
    const results = await db.select()
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permission_id, permissionsTable.id))
      .where(eq(rolePermissionsTable.role, role))
      .execute();

    // Extract permission data from joined results
    return results.map(result => result.permissions);
  } catch (error) {
    console.error('Failed to get permissions by role:', error);
    throw error;
  }
};

export const getAllPermissions = async (): Promise<Permission[]> => {
  try {
    const results = await db.select()
      .from(permissionsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get all permissions:', error);
    throw error;
  }
};

export const getRolePermissions = async (): Promise<RolePermission[]> => {
  try {
    const results = await db.select()
      .from(rolePermissionsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get role permissions:', error);
    throw error;
  }
};