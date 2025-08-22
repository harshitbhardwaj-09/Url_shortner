import {db} from '../db/index'
import {usersTable} from '../models/index'
import {eq} from 'drizzle-orm'

export async function getUserByEmail(email:string){
    const [existingUser]=await db.select({
        id:usersTable.id,
        firstName:usersTable.firstName,
        lastName:usersTable.lastName,
        email:usersTable.email,
        
    }).from(usersTable)
    .where(eq(usersTable.email,email));

    return existingUser;

}