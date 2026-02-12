# TruHarvest - Inventory Management System

Odoo-integrated Inventory Management System with Next.js frontend and FastAPI middleware.

## Architecture

```
Frontend (Next.js)  <-->  Middleware (FastAPI)  <-->  Odoo (XML-RPC)
     :3000                    :8000                    :8069
```

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python run.py
```

The API will be available at `http://localhost:8000` with docs at `/docs`.

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
TruHarvest/
├── backend/                    # FastAPI middleware
│   ├── app/
│   │   ├── api/v1/            # API endpoints (products, stock, invoices, sync)
│   │   ├── core/              # Config, exceptions, logging
│   │   ├── models/            # Pydantic request/response models
│   │   ├── services/          # Business logic & Odoo client
│   │   └── main.py            # Application entry point
│   ├── .env                   # Environment variables
│   ├── requirements.txt       # Python dependencies
│   └── run.py                 # Development server
│
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/               # Pages (dashboard, products, stock, invoices)
│   │   ├── components/        # UI components (shadcn/ui + custom)
│   │   ├── hooks/             # React Query hooks
│   │   └── lib/               # API client, types, utilities
│   ├── .env.local             # Frontend environment variables
│   └── package.json
│
└── README.md
```

## API Endpoints

| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| GET    | /api/v1/products           | List products            |
| GET    | /api/v1/products/{id}      | Get product details      |
| POST   | /api/v1/products           | Create product           |
| PUT    | /api/v1/products/{id}      | Update product           |
| DELETE | /api/v1/products/{id}      | Archive product          |
| GET    | /api/v1/products/stock     | Stock levels             |
| POST   | /api/v1/products/search    | Search products          |
| GET    | /api/v1/stock/movements    | Stock movement history   |
| POST   | /api/v1/stock/incoming     | Create incoming shipment |
| POST   | /api/v1/stock/outgoing     | Create outgoing delivery |
| POST   | /api/v1/stock/adjust       | Adjust stock             |
| GET    | /api/v1/invoices           | List invoices            |
| GET    | /api/v1/invoices/{id}      | Get invoice              |
| POST   | /api/v1/invoices           | Create invoice           |
| POST   | /api/v1/invoices/{id}/confirm | Confirm invoice       |
| GET    | /api/v1/invoices/{id}/pdf  | Download PDF             |
| GET    | /api/v1/dashboard          | Dashboard stats          |
| GET    | /api/v1/health             | Health check             |
| GET    | /api/v1/sync/status        | Sync status              |
| POST   | /api/v1/sync/trigger       | Trigger sync             |

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, TailwindCSS v4, shadcn/ui, React Query, Recharts
- **Middleware**: FastAPI, Pydantic, XML-RPC
- **Backend**: Odoo 16+ ERP
- **Database**: PostgreSQL
