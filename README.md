# Dynamic Model Builder & CRUD Management System

A no-code/low-code platform that allows administrators to dynamically create data models through a UI, automatically generating database tables, REST API endpoints, and admin interfaces with role-based access control.

## Features

- **Dynamic Model Creation**: Define models through UI without writing code
- **Auto-generated CRUD APIs**: Automatic REST endpoints for each model
- **Role-Based Access Control (RBAC)**: Granular permissions per model and role
- **Real-time Model Registration**: Models are loaded and registered on-the-fly
- **Type Support**: String, Number, Boolean, Date field types
- **JWT Authentication**: Secure token-based authentication
- **PostgreSQL Database**: Reliable data persistence with Sequelize ORM

## Architecture

### Tech Stack

**Backend:**
- Node.js + Express
- Sequelize ORM
- PostgreSQL
- JWT for authentication
- bcrypt for password hashing

**Frontend:**
- React 18
- React Router v6
- Axios for API calls
- JWT decoding

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd dynamic-crud-system
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
PORT=3001
DB_NAME=your_database_name
DB_USER=your_postgres_user
DB_PASS=your_postgres_password
DB_HOST=localhost
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
```

Create the PostgreSQL database:

```bash
psql -U postgres
CREATE DATABASE your_database_name;
\q
```

Start the backend server:

```bash
npm start
```

The server will start on `http://localhost:3001`

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
VITE_REACT_APP_API_URL=http://localhost:3001
```

Start the development server:

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

## User Roles

The system supports three roles with different permission levels:

1. **Admin**: Full access + ability to create models
2. **Manager**: Read, Create, Update (customizable per model)
3. **Viewer**: Read-only (customizable per model)

## How to Create & Publish a Model

### Step-by-Step Guide

1. **Sign Up / Login as Admin**
   - Navigate to `/signup`
   - Create an account with role "Admin"
   - Login with your credentials

2. **Access Model Builder**
   - Click "Model Builder" in the navigation
   - Only visible to Admin users

3. **Define Your Model**
   - **Model Name**: Enter a name (e.g., "Product", "Customer")
   - **Add Fields**: Click "+ Add Field" to add properties
     - Field Name: e.g., "name", "price", "description"
     - Field Type: String, Number, Boolean, or Date
     - Required: Check if field is mandatory

4. **Configure RBAC Permissions**
   - Set permissions for each role:
     - **create**: Can add new records
     - **read**: Can view records
     - **update**: Can edit records
     - **delete**: Can remove records
     - **all**: Full access (equivalent to all above)

5. **Publish the Model**
   - Click "Publish Model"
   - Backend will:
     - Save model definition to `/models-config/{ModelName}.json`
     - Register CRUD routes automatically
     - Create database table with Sequelize
   - You'll be redirected to the data management page

### Example Model Configuration

```json
{
  "name": "Product",
  "fields": [
    {
      "name": "name",
      "type": "string",
      "required": true
    },
    {
      "name": "price",
      "type": "number",
      "required": true
    },
    {
      "name": "inStock",
      "type": "boolean",
      "required": false
    },
    {
      "name": "description",
      "type": "string",
      "required": false
    }
  ],
  "rbac": {
    "Admin": ["all"],
    "Manager": ["read", "create", "update"],
    "Viewer": ["read"]
  }
}
```

## 🔧 How File-Write Works

### Model Persistence Flow

1. **Admin publishes model via UI**
   ```
   POST /api/models/publish
   Body: { name, fields, rbac }
   ```

2. **Backend receives model configuration**
   ```javascript
   app.post('/api/models/publish', authMiddleware, adminOnly, async (req, res) => {
     const modelConfig = req.body;
     const modelName = modelConfig.name;
     
     // Write to file system
     const filePath = path.join(MODELS_CONFIG_DIR, `${modelName}.json`);
     await fs.writeJson(filePath, modelConfig, { spaces: 2 });
     
     // Register model dynamically
     await registerModel(modelConfig);
   });
   ```

3. **File is written to disk**
   - Location: `/backend/models-config/{ModelName}.json`
   - Format: Pretty-printed JSON (2 spaces)
   - Persists across server restarts

4. **Model is registered in-memory**
   - Stored in `dynamicModels` object
   - Available for route generation

### On Server Startup

```javascript
async function loadModelsFromFiles() {
  // Read all JSON files from models-config directory
  const files = await fs.readdir(MODELS_CONFIG_DIR);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const config = await fs.readJson(filePath);
      await registerModel(config); // Register each model
    }
  }
}
```


### Generated Endpoints Example

For a "Product" model, these endpoints are created:

```
POST   /api/product          (Create)
GET    /api/product          (List all)
GET    /api/product/:id      (Get one)
PUT    /api/product/:id      (Update)
DELETE /api/product/:id      (Delete)
```

## Project Structure

```
dynamic-crud-system/
├── backend/
│   ├── models/
│   │   └── User.js              # Static User model
│   ├── models-config/           # Dynamic model definitions (JSON)
│   │   ├── Product.json         # Example model
│   │   └── Customer.json        # Example model
│   ├── db.js                    # Sequelize configuration
│   ├── index.js                 # Main server file
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main React component
│   │   ├── index.css            # Styles
│   │   └── main.jsx             # Entry point
│   ├── package.json
│   └── .env
└── README.md
```


## Screenshots & Demo

> **For deliverables, include:**
> - Login page screenshot
![alt text](<pictures/Screenshot from 2025-11-03 04-49-13.png>)
> - Signup page screenshot
![alt text](<pictures/Screenshot from 2025-11-03 04-49-26.png>)
> - Model Builder interface
![alt text](<pictures/Screenshot from 2025-11-03 04-52-06.png>)
> - Published model data table
> - CRUD operations in action
![alt text](<pictures/Screenshot from 2025-11-03 04-52-32.png>)
> - Sample model JSON file
![alt text](<pictures/Pasted image.png>)
