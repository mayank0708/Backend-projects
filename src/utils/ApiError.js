// this file is used to standardized error  messages
// and provide a way for the user to know what went wrong.
// and we don't need to code  in every single case, just use it when needed


class ApiError extends Error{
    constructor(statusCode,message="Something went wrong", errors = [], stack=""){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors


        if(stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}