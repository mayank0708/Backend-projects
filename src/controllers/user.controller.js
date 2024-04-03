import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User }  from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { generateAccessToken, generateRefreshToken } from '../utils/jwtUtils.js'
import  jwt  from "jsonwebtoken"
import { secretKey } from "../utils/jwtConfig.js"

// const generateAccessAndRefreshTokens = async(userId) => {
//     try{
//         const user = await User.findById(userId)
//         const accessToken = user.generateAccessToken()
//         const refreshToken = user.generateRefreshToken()

//         user.refreshToken = refreshToken
//         await user.save({ validateBeforeSave: false})
//         console.log(accessToken, refreshToken);

//         return { accessToken, refreshToken }

//     } 
//     catch(e){
//         // throw new ApiError(500, "Something went wrong while generating refresh and access token")
//         console.log("Error FOUND", e)
//     }
// } 

const registerUser = asyncHandler( async (req, res) => {
    //get user details from frontend
    //validation  -  not empty
    //check if user already exists : username, email
    //check for images , check for avatar
    //upload them to cloudinary
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return res

    const {username, fullName, email, password} = req.body
    // console.log("email",email )

    if(
        [fullName, email, username, password].some((field) => field?.trim()==="")
    )
    {
        throw new  ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }


    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;


    // let coverImageLocalPath;
    // if (req.files && Array.isArray(req.files.coverImage) 
    // && req.files.coverImage.length>0) 
    // {
    //     coverImageLocalPath = req.files.coverImage[0].path;
    // }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user =  await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while entering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully!")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    //username or email based access login
    //find the user
    // check for password if user is in database
    //access and refresh token  generation
    //send cookies with access and refresh token

    const {email, username, password} = req.body
    
    if(!username && !email){
        throw new ApiError(400, "username or password is required!")
    }

    const user = await User.findOne({
        $or: [ {username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User doesn't exists")
    }


    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User credentials")
    }
    
    //create tokens
    const  accessToken = generateAccessToken(user)
    const  refreshToken= generateRefreshToken(user)
    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")


    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, 
                accessToken, 
                refreshToken
            },
            "User logged In seccessfully"
        )
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    //clear cookies 
    //reset refreshToken
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new:true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))

})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if( !incomingRefreshToken ){
        throw new ApiError(401, "Unauthorized request")
    }
  
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, secretKey)
    
        const user = await User.findById(decodedToken._id)
        if( !user ){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken)
        {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        //Generate a new access token and update the users tokens in database
        const  accessToken = generateAccessToken(user)
        const  newRefreshToken = generateRefreshToken(user)
        user.refreshToken=newRefreshToken
        await user.save({validateBeforeSave: false})
    
    
        const options={
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie( "accessToken", accessToken ,options )
        .cookie("refreshToken", newRefreshToken ,options )
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                'Access token refreshed successfully'
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message ||  "Invalid refresh token")
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}


