## 🎟️ StagePass Worker

**StagePass** is a REST API for **event creation**, **ticket sales**, and **secure online purchases**.  
It is built with **NestJS, PostgreSQL, Drizzle, RabbitMQ, and Docker**, focusing on real-world challenges like  
**ticket reservation concurrency, payment integration, and background processing**.

### 🔑 Key Features

- 🔐 **User Authentication** — email/password with refresh token auth flow, Google OAuth, and One-Time Password (OTP).
- 📅 **Event Management** — create, list, search, and filter events with geolocation support.
- 🎫 **Ticket Reservations** — with expiration timers and concurrency locks to avoid overselling.
- 💳 **Payments** — secure checkout flow with Stripe sandbox integration.
- 📄 **Digital Tickets** — automated PDF/QR code generation and email delivery.

---

StagePass simulates a **production-ready ticketing system** inspired by platforms like _Eventbrite_ and _Sympla_,  
serving as a **portfolio project** to showcase Back-End skills.
