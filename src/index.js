// require('dotenv').config()
import dotenv from "dotenv";  // experimental
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: './env'
})


connectDB()
.then(() => {
    app.on("error", (error)=>{
        console.log("ERROR", error)
    })

    app.listen(process.env.PORT  || 8000, () => {
        console.log(`Server is runnung at port : ${process.env.PORT}`)
    })
})
.catch((error) => {
    console.log("MongoDB connection failed !!! ", error)
})



















/*
import express from "express";
const app = express()

( async() => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("Error", error)
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on PORT ${process.env.PORT}`)
        })
    }catch(error){
        console.log("ERROR", error)
        throw error
    }
})()

*/