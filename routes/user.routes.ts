import express from 'express';
import {db} from '../db/index.ts'
import {usersTable} from '../models/index.ts'
import {eq} from 'drizzle-orm'
import { randomBytes , createHmac} from 'crypto';
const router=express.Router();

router.post('/signup',async(req,res)=>{
    const {firstName,lastName,email,password}=req.body;

    const [existingUser]=await db.select({
        id:usersTable.id,
    }).from(usersTable)
    .where(eq(usersTable.email,email));

    if(existingUser){
        return res
        .status(400)
        .json({
            error: `user with email ${email} already exist!`
        })
    }
    const salt = randomBytes(256).toString('hex');
    const hashedPassword = createHmac('sha256',salt).update(password).digest('hex');
    const [user] =await db.insert(usersTable).values({
        email,
        firstName,
        lastName,
        salt,
        password:hashedPassword,
    })
    .returning({id: usersTable.id})

    return res.status(201).json({
        data: {userId: user.id}
    })

})

export default router;