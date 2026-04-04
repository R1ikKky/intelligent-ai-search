import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  ELASTICSEARCH_NODE: Joi.string().uri().required(),
  ELASTICSEARCH_INDEX: Joi.string().default('products'),
  AUTO_REINDEX_ON_START: Joi.string().valid('true', 'false').default('false'),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  MAX_SCORE: Joi.number().default(100),
  BOOST_MAX: Joi.number().default(2.0),
});
