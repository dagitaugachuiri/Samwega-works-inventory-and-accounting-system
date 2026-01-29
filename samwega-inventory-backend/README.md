# Samwega Inventory & POS Backend

A scalable, high-performance backend for the Samwega Works Inventory and Point of Sale accounting system.

## Features

- 🔐 **Authentication & Authorization**: Firebase Auth with JWT tokens and role-based access control
- 📦 **Inventory Management**: Multi-location inventory tracking with packaging structure support
- 🚚 **Vehicle & Transfer Management**: Stock issuance and vehicle inventory tracking
- 💰 **Sales & POS**: Transaction processing with minimum price validation
- 📊 **Reporting & Analytics**: Comprehensive reports with PDF generation
- 📱 **SMS Notifications**: TextSMS API integration for alerts
- ☁️ **Cloud Storage**: Cloudinary integration for file storage
- ⚡ **Caching**: Redis caching for improved performance
- 📝 **Logging**: Winston logger with file and console outputs
- 🛡️ **Security**: Helmet, CORS, rate limiting, input validation

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Database**: Firebase Firestore
- **Cache**: Redis (ioredis)
- **File Storage**: Cloudinary
- **SMS**: TextSMS API
- **Validation**: Joi
- **Logging**: Winston
- **Testing**: Jest + Supertest

## Project Structure

```
samwega-inventory-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic
│   ├── controllers/     # Request handlers
│   ├── routes/          # API routes
│   ├── validators/      # Input validation schemas
│   ├── utils/           # Utility functions
│   ├── jobs/            # Background jobs
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── tests/               # Test files
├── logs/                # Log files
├── .env.example         # Environment variables template
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 18.x
- Firebase project with Firestore
- Redis server (optional, for caching)
- TextSMS API credentials
- Cloudinary account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd samwega-inventory-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
- Firebase credentials
- Redis connection details
- TextSMS API keys
- Cloudinary credentials
- JWT secret

4. Add Firebase service account key:
- Download `serviceAccountKey.json` from Firebase Console
- Place it in the root directory

### Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## API Documentation

### Base URL
```
http://localhost:8080/api
```

### Health Check
```
GET /health
```

### API Endpoints (Coming in Phase 2+)

- `/api/v1/auth` - Authentication
- `/api/v1/inventory` - Inventory management
- `/api/v1/vehicles` - Vehicle management
- `/api/v1/suppliers` - Supplier management
- `/api/v1/sales` - Sales transactions
- `/api/v1/expenses` - Expense tracking
- `/api/v1/reports` - Report generation

## Environment Variables

See `.env.example` for all required environment variables.

## Development Roadmap

### ✅ Phase 1: Foundation (Current)
- Project structure setup
- Configuration files
- Middleware implementation
- Utility functions
- Base application setup

### 🔄 Phase 2: Authentication Service (Next)
- User registration & login
- JWT token management
- Role-based access control

### 📋 Phase 3-10: Feature Implementation
- Inventory Service
- Supplier & Invoice Service
- Vehicle & Transfer Service
- Sales & POS Service
- Expense Service
- Reporting Service
- Real-time Sync
- Monolith Decommission

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## License

ISC

## Support

For support, contact Samwega Works LTD.
