export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    user: process.env.POSTGRES_USER ?? 'search_user',
    password: process.env.POSTGRES_PASSWORD ?? 'search_pass',
    database: process.env.POSTGRES_DB ?? 'search_db',
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
    index: process.env.ELASTICSEARCH_INDEX ?? 'products',
    autoReindexOnStart: process.env.AUTO_REINDEX_ON_START === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  personalization: {
    maxScore: parseFloat(process.env.MAX_SCORE ?? '100'),
    boostMax: parseFloat(process.env.BOOST_MAX ?? '2.0'),
  },
});
