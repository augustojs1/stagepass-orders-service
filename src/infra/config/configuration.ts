export const configuration = () => ({
  app_host: process.env.APP_HOST,
  NODE_ENV: process.env.NODE_ENV,
  port: parseInt(process.env.PORT, 10) || 8080,
  database: {
    tag: process.env.DB_TAG,
    url: process.env.DB_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE_IN,
    expiresInMs: process.env.JWT_EXPIRE_IN_MS,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    refresh_expiresIn: process.env.JWT_REFRESH_EXPIRE_IN,
    refresh_expiresInMs: process.env.JWT_REFRESH_EXPIRE_IN_MS,
  },
  geocoder_api_key: process.env.GEOCODER_PROVIDER_API_KEY,
  r2: {
    access_key: process.env.R2_ACCESS_KEY_ID,
    secret_access_key: process.env.R2_SECRET_ACCESS_KEY_ID,
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION,
    bucket: process.env.R2_BUCKET,
    public_url: process.env.R2_PUBLIC_URL,
  },
  rmq: {
    url: process.env.RMQ_URL,
    queue_payment_failed: process.env.RMQ_QUEUE_PAYMENT_FAILED,
    queue_payment_succes: process.env.RMQ_QUEUE_PAYMENT_SUCCESS,
    queue_ticket_generate: process.env.RMQ_QUEUE_TICKET_GENERATE,
    queue_email_send: process.env.RMQ_QUEUE_EMAIL_SEND,
  },
  aws: {
    region: process.env.AWS_REGION,
    s3: {
      public_url: process.env.AWS_S3_PUBLIC_URL,
      bucket: process.env.AWS_S3_BUCKET,
    },
    sqs: {
      tickets_generate_queue_url: process.env.AWS_SQS_TICKETS_QUEUE_URL,
      emails_queue_url: process.env.AWS_SQS_EMAIL_QUEUE_URL,
      payment_success_queue_url: process.env.AWS_SQS_PAYMENT_SUCCESS,
      payment_failed_queue_url: process.env.AWS_SQS_PAYMENT_FAILED,
    },
    ses: {
      email_from: process.env.AWS_SES_EMAIL_FROM,
    },
  },
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY,
    webhook_key: process.env.STRIPE_WEBHOOK_KEY,
  },
});
