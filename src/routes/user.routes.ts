import express from 'express';
import {db} from '../db/index'
import {usersTable} from '../models/index'
import {eq} from 'drizzle-orm'
import { randomBytes , createHmac} from 'crypto';
import {signupPostRequestBodySchema} from '../validation/request.validation'
const router=express.Router();

router.post('/signup',async(req,res)=>{
    const validationResult = await signupPostRequestBodySchema.safeParseAsync(req.body);
    if(validationResult.error){
        return res.status(400).json({error: validationResult.error.message});
    }
    const {email, firstName, lastName, password} = validationResult.data;
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