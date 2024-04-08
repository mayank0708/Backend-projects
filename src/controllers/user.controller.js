import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User }  from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { generateAccessToken, generateRefreshToken } from '../utils/jwtUtils.js'
import  jwt  from "jsonwebtoken"
import { secretKey } from "../utils/jwtConfig.js"
import  mongoose  from "mongoose"
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

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword, newPassword} =req.body

    const user = await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(400, "Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave :false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User Fetched Successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res)=>{
    const {fullName, email } = req.body

    if(!fullName || !email){
        throw new ApiError(400, "All fields are rewuired")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Account details Updated Successfully")
        )
})

const updateUserAvatar = asyncHandler(async(req, res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new  ApiError(400, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req, res)=>{
    const coverLocalPath = req.file?.path

    if(!coverLocalPath){
        throw new ApiError(400, "Cover file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverLocalPath)

    if(!coverImage.url){
        throw new  ApiError(400, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated successfully"))
})

const getUserChannelProfile = asyncHandler( async(req, res) => {
    const {username } = req.params

    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([{
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
        $lookup:{
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup:{
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount: {
                $size: "$subscribers"
            },
            channelsSubscribedToCount: {
                $size: "$subscribedTo"
            },
            isSubscribed: {
                $cond : {
                    if: {$in: [req.user?._id, "$subscribers.subscriber"]},  
                    then: true,  
                    else: false
                }
            }
        }
    },
    {
        $project: {
            fullName: 1,
            username: 1,
            subscribersCount: 1,
            channelsSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
        }
    }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel doesn't exists")
    }

    return res
    .status(200)
    .json(new ApiResponse (200, channel[0], "User channel fetched successfully!!"))

})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([{
        $match: {
            _id: new mongoose.Types.ObjectId(req.user._id)
        }
    },
    {
        $lookup: {
            from: "videos",
            localField: "watchHisory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline: [
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField:"_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    username: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    }
                },
                {
                    $addFields: {
                        owner: {
                            $first: "$owner"
                        }
                    }
                }
            ]
        }
    }
])

return res
.status(200)
.json(new ApiResponse (200, user[0].watchHistory, "Watch history fetched successfully"))
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}


