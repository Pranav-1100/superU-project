const Joi = require('joi');

// Validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        // Replace request body with validated value
        req.body = value;
        next();
    };
};

// Validation schemas
const schemas = {
    // Auth schemas
    register: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .trim()
            .lowercase()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string()
            .min(8)
            .max(128)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.max': 'Password must not exceed 128 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
                'any.required': 'Password is required'
            })
    }),

    login: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .trim()
            .lowercase()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string()
            .required()
            .messages({
                'any.required': 'Password is required'
            })
    }),

    // Team schemas
    createTeam: Joi.object({
        name: Joi.string()
            .min(3)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.min': 'Team name must be at least 3 characters long',
                'string.max': 'Team name must not exceed 100 characters',
                'any.required': 'Team name is required'
            })
    }),

    inviteMember: Joi.object({
        team_id: Joi.string()
            .uuid()
            .required()
            .messages({
                'string.guid': 'Invalid team ID format',
                'any.required': 'Team ID is required'
            }),
        email: Joi.string()
            .email()
            .required()
            .trim()
            .lowercase()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        role: Joi.string()
            .valid('admin', 'member')
            .required()
            .messages({
                'any.only': 'Role must be either "admin" or "member"',
                'any.required': 'Role is required'
            })
    }),

    // Content schemas
    scrapeContent: Joi.object({
        url: Joi.string()
            .uri()
            .required()
            .trim()
            .messages({
                'string.uri': 'Please provide a valid URL',
                'any.required': 'URL is required'
            }),
        team_id: Joi.string()
            .uuid()
            .required()
            .messages({
                'string.guid': 'Invalid team ID format',
                'any.required': 'Team ID is required'
            })
    }),

    updateNode: Joi.object({
        content: Joi.string()
            .required()
            .max(1000000) // 1MB max
            .messages({
                'string.max': 'Content is too large (max 1MB)',
                'any.required': 'Content is required'
            })
    }),

    searchContent: Joi.object({
        q: Joi.string()
            .min(1)
            .max(200)
            .required()
            .trim()
            .messages({
                'string.min': 'Search query must be at least 1 character',
                'string.max': 'Search query must not exceed 200 characters',
                'any.required': 'Search query is required'
            })
    })
};

module.exports = {
    validate,
    schemas
};
