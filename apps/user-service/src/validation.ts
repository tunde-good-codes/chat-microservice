import Joi from "joi";


export const createUserProfileSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  displayName: Joi.string().required().messages({
    "any.required": "Display name is required",
  }),
});
