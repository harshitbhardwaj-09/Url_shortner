import express from 'express';
import {db} from '../db/index'
import {usersTable} from '../models/index'
import {signupPostRequestBodySchema,loginPostRequestBodySchema} from '../validation/request.validation'
import {hashPasswordWithSalt} from '../utils/hash'
import {createHmac} from 'crypto'
import {getUserByEmail} from '../services/user.service'
import {generateToken} from '../utils/jwt'


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

router.post('/login',async(req,res)=>{
    const validationResult=await loginPostRequestBodySchema.safeParseAsync(req.body);
    if(validationResult.error){
        return res.status(400).json({error: validationResult.error.message})
    }

    const {email,password}=validationResult.data;

    const user = await getUserByEmail(email);

    if(!user){
        return res.status(404).json({error: `User with email ${email} does not exist`});
    }

    const hashedPassword = createHmac('sha256',user.salt).update(password).digest('hex');

    if(user.password!==hashedPassword){
        return res.status(400).json({error : 'Invalid password'});
    }
    const token = generateToken(user.id);
    
    return res.json({token});
});

export default router;