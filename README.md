## 🎟️ StagePass Orders Service

**StagePass Orders Service** is a REST API responsible for **event management**, **ticket reservations**, **order processing**, and **secure online payments**.

Built with **NestJS, TypeScript, PostgreSQL, Drizzle ORM, AWS SQS, and Docker**, it focuses on real-world Back-End challenges such as **concurrency control, payment consistency, idempotency, and asynchronous processing**.

### 🔑 Key Features

- 🔐 **User Authentication** — JWT authentication with access and refresh tokens, HTTP-only cookies, and user profile management.
- 🎫 **Ticket Reservations** — expiration handling and concurrency control to prevent overselling.
- 💳 **Order & Payment Processing** — order lifecycle management, Stripe Checkout integration, and webhook-based payment confirmation.
- ⚡ **Asynchronous Processing** — background jobs using AWS SQS for payment processing, ticket generation, and email delivery.

---

StagePass Orders Service is a **Back-End portfolio project** inspired by platforms like _Eventbrite_ and _Sympla_, designed to demonstrate practical experience with **transactional systems, asynchronous workflows, and cloud-integrated Back-End development**.
