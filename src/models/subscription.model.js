import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new  Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // one who is subscribing
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, // one to whom is subscribing
        ref: "User"
    }
},
{timestamps})


export const Subscription = mongoose.Model("Subscription", subscriptionSchema)