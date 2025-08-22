import express from 'express';
import {db} from '../db/index'
import {usersTable} from '../models/index'
import {signupPostRequestBodySchema} from '../validation/request.validation'
import {hashPasswordWithSalt} from '../utils/hash'
import {getUserByEmail} from '../services/user.service'


const router=express.Router();

router.post('/signup',async(req,res)=>{
    const validationResult = await signupPostRequestBodySchema.safeParseAsync(req.body);
    if(validationResult.error){
        return res.status(400).json({error: validationResult.error.message});
    }
    const {email, firstName, lastName, password} = validationResult.data;

    const existingUser=await getUserByEmail(email);


    if(existingUser){
        return res
        .status(400)
        .json({
            error: `user with email ${email} already exist!`
        })
    }

    const {salt,password:hashedPassword}=hashPasswordWithSalt(password);
   
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