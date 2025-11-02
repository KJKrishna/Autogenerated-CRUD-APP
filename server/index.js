const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');
const { sequelize, Sequelize } = require('./db');
const User = require('./models/User');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const MODELS_CONFIG_DIR = path.join(__dirname, 'models-config');

// This map will hold our dynamically registered models and their configs
const dynamicModels = {};

// =================================================================
// 1. AUTHENTICATION MIDDLEWARE & ROUTES
// =================================================================

const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).send('Access denied. No token provided.');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).send('Invalid token.');
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).send('Forbidden. Admin access required.');
  }
  next();
};


// Signup Route
app.post('/auth/signup', async (req, res) => {
  console.log('--- SIGNUP ATTEMPT ---'); 
  try {
    const { username, password, role } = req.body;
    console.log('1. Received data:', { username, role }); 

    if (!['Admin', 'Manager', 'Viewer'].includes(role)) {
      console.log('2. Error: Invalid role.'); 
      return res.status(400).send('Invalid role.');
    }

    const user = await User.create({ username, password, role });
    console.log('3. User.create SUCCEEDED. User ID:', user.id); 

    res.status(201).send({ id: user.id, username: user.username, role: user.role });

  } catch (error) {
    console.log('4. Error during signup:', error.message); 
    console.error(error); 
    res.status(400).send(error.message);
  }
});


// Login Route
app.post('/auth/login', async (req, res) => {
  console.log('--- LOGIN ATTEMPT ---'); // <-- ADD THIS
  try {
    const { username, password } = req.body;
    console.log('1. Received data:', { username }); // <-- ADD THIS

    const user = await User.findOne({ where: { username } });
    if (!user) {
      console.log('2. Error: User not found in database.'); // <-- ADD THIS
      return res.status(400).send('Invalid username or password.');
    }

    console.log('3. User found. Checking password...'); // <-- ADD THIS
    const validPassword = await user.isValidPassword(password);

    if (!validPassword) {
      console.log('4. Error: Password comparison failed.'); // <-- ADD THIS
      return res.status(400).send('Invalid username or password.');
    }

    console.log('5. Login SUCCEEDED.'); // <-- ADD THIS
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '1h',
    });
    res.send({ token });

  } catch (error) {
    console.log('6. Error during login:', error.message); // <-- ADD THIS
    res.status(500).send(error.message);
  }
});

// =================================================================
// 2. DYNAMIC MODEL & ROUTE GENERATION (THE "MAGIC")
// =================================================================

// This router will hold all our dynamically generated CRUD routes
const dynamicApiRouter = express.Router();
app.use('/api', dynamicApiRouter); // Plug it into our app

/**
 * Converts a JSON field type to a Sequelize data type.
 */
function getSequelizeType(type) {
  switch (type) {
    case 'string':
      return Sequelize.STRING;
    case 'number':
      return Sequelize.FLOAT; // Use FLOAT for general numbers
    case 'boolean':
      return Sequelize.BOOLEAN;
    case 'date':
      return Sequelize.DATE;
    default:
      return Sequelize.STRING;
  }
}

/**
 * Creates a dynamic RBAC middleware for a specific model and action.
 */
function createRbacMiddleware(modelConfig, action) {
  return (req, res, next) => {
    const userRole = req.user.role; // From authMiddleware
    const permissions = modelConfig.rbac[userRole];

    if (permissions && (permissions.includes(action) || permissions.includes('all'))) {
      // TODO: Add ownerField check logic here if action is 'update' or 'delete'
      return next();
    }
    
    return res.status(403).send(`Forbidden: Role '${userRole}' cannot perform '${action}' on ${modelConfig.name}.`);
  };
}

/**
 * Registers a model with Sequelize and generates its CRUD routes.
 */
async function registerModel(modelConfig) {
  const modelName = modelConfig.name;
  const tableName = modelConfig.tableName || `${modelName.toLowerCase()}s`;

  // 1. Convert JSON fields to Sequelize schema
  const schema = {};
  for (const field of modelConfig.fields) {
    schema[field.name] = {
      type: getSequelizeType(field.type),
      allowNull: !field.required,
      defaultValue: field.default,
      unique: !!field.unique,
    };
  }

  // 2. Define the model with Sequelize
  const DynamicModel = sequelize.define(modelName, schema, { tableName });
  
  // Store it for future reference
  dynamicModels[modelName] = {
    model: DynamicModel,
    config: modelConfig,
  };

  // 3. Generate dynamic CRUD routes
  const routeBase = `/${modelName.toLowerCase()}`;

  // CREATE
  dynamicApiRouter.post(
    routeBase,
    authMiddleware,
    createRbacMiddleware(modelConfig, 'create'),
    async (req, res) => {
      try {
        // TODO: Add ownerId from req.user.id if ownerField is set
        const item = await DynamicModel.create(req.body);
        res.status(201).send(item);
      } catch (e) { res.status(400).send(e.message); }
    }
  );

  // READ (List)
  dynamicApiRouter.get(
    routeBase,
    authMiddleware,
    createRbacMiddleware(modelConfig, 'read'),
    async (req, res) => {
      try {
        const items = await DynamicModel.findAll();
        res.send(items);
      } catch (e) { res.status(500).send(e.message); }
    }
  );

  // READ (One)
  dynamicApiRouter.get(
    `${routeBase}/:id`,
    authMiddleware,
    createRbacMiddleware(modelConfig, 'read'),
    async (req, res) => {
      try {
        const item = await DynamicModel.findByPk(req.params.id);
        if (!item) return res.status(404).send('Not found');
        res.send(item);
      } catch (e) { res.status(500).send(e.message); }
    }
  );

  // UPDATE
  dynamicApiRouter.put(
    `${routeBase}/:id`,
    authMiddleware,
    createRbacMiddleware(modelConfig, 'update'),
    async (req, res) => {
      try {
        const item = await DynamicModel.findByPk(req.params.id);
        if (!item) return res.status(404).send('Not found');
        
        await item.update(req.body);
        res.send(item);
      } catch (e) { res.status(400).send(e.message); }
    }
  );

  // DELETE
  dynamicApiRouter.delete(
    `${routeBase}/:id`,
    authMiddleware,
    createRbacMiddleware(modelConfig, 'delete'),
    async (req, res) => {
      try {
        const item = await DynamicModel.findByPk(req.params.id);
        if (!item) return res.status(404).send('Not found');

        await item.destroy();
        res.status(204).send();
      } catch (e) { res.status(500).send(e.message); }
    }
  );

  console.log(`Registered routes for model: ${modelName}`);
  
  // 4. Sync model with DB (THIS IS NOT SAFE FOR PROD, but fine for this demo)
  // In prod, you'd generate a migration file.
  await DynamicModel.sync({ alter: true });
}

/**
 * Loads all model definitions from the /models-config directory on startup.
 */
async function loadModelsFromFiles() {
  try {
    await fs.ensureDir(MODELS_CONFIG_DIR);
    const files = await fs.readdir(MODELS_CONFIG_DIR);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(MODELS_CONFIG_DIR, file);
        const config = await fs.readJson(filePath);
        await registerModel(config);
      }
    }
  } catch (error) {
    console.error('Error loading models:', error);
  }
}

// =================================================================
// 3. MODEL DEFINITION API (for the Admin UI)
// =================================================================

// Endpoint for the UI to publish a new model
app.post('/api/models/publish', authMiddleware, adminOnly, async (req, res) => {
  try {
    const modelConfig = req.body;
    const modelName = modelConfig.name;

    if (!modelName || !modelConfig.fields || !modelConfig.rbac) {
      return res.status(400).send('Invalid model configuration.');
    }
    
    // 1. Write the model definition to a file
    const filePath = path.join(MODELS_CONFIG_DIR, `${modelName}.json`);
    await fs.writeJson(filePath, modelConfig, { spaces: 2 });

    // 2. Register the model (and its routes) dynamically
    // Check if it already exists to avoid conflicts (simple check)
    if (dynamicModels[modelName]) {
      console.warn(`Hot-reloading model: ${modelName}. (In a real app, this is complex!)`);
      // A true hot-reload would need to unregister old routes.
      // For this simple demo, we just register (which re-syncs the DB).
    }
    await registerModel(modelConfig);

    res.status(201).send({ message: `Model ${modelName} published successfully.` });
  } catch (error) {
    console.error('Error publishing model:', error);
    res.status(500).send(error.message);
  }
});

// Endpoint for the UI to get all model schemas
app.get('/api/models', authMiddleware, async (req, res) => {
  try {
    const models = Object.values(dynamicModels).map(m => m.config);
    res.send(models);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Endpoint for the UI to get a single model schema
app.get('/api/models/:modelName', authMiddleware, (req, res) => {
  const modelData = dynamicModels[req.params.modelName];
  if (!modelData) {
    return res.status(404).send('Model schema not found.');
  }
  res.send(modelData.config);
});


// =================================================================
// 4. START THE SERVER
// =================================================================

async function startServer() {
  try {
    // Sync the static 'User' model
    await User.sync({ alter: true });
    
    // Load all dynamic models from files
    await loadModelsFromFiles();
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer();