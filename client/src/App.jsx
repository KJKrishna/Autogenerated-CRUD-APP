import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  Navigate,
  useParams,
} from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// --- API Client ---
const api = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Auth Context ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decodedUser = jwtDecode(token);
        setUser(decodedUser);
      } catch (error) {
        console.error('Invalid token');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  
  const login = async (username, password) => {
  try { // Add a try/catch here for debugging
    const res = await api.post('/auth/login', { username, password });
    const { token } = res.data;
    console.log('Login success, got token:', token); // <-- ADD THIS
    localStorage.setItem('token', token);
    
    const decodedUser = jwtDecode(token); 
    console.log('Decoded user:', decodedUser); // <-- ADD THIS
    setUser(decodedUser);
    
  } catch (e) {
    console.error('Frontend login function failed!', e); // <-- ADD THIS
    throw e; // Re-throw the error so handleSubmit can catch it
  }
};

  const signup = async (username, password, role) => {
    await api.post('/auth/signup', { username, password, role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- Protected Route Components ---
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/" />;

  return children;
};

// --- App Layout ---
const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <nav>
        <Link to="/">Dashboard</Link>
        {user?.role === 'Admin' && <Link to="/build">Model Builder</Link>}
        {user && <button onClick={handleLogout}>Logout ({user.username} - {user.role})</button>}
      </nav>
      <div className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/build"
            element={
              <ProtectedRoute adminOnly={true}>
                <ModelBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/data/:modelName"
            element={
              <ProtectedRoute>
                <DataManagementPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
};

// --- Pages ---
const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="container page-login">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Login</button>
        <p>
          Need an account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </div>
  );
};

const SignupPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Viewer');
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signup(username, password, role);
      navigate('/login');
      alert('Signup successful! Please log in.');
    } catch (err) {
      setError('Failed to sign up. Username might be taken.');
    }
  };

  return (
    <div className="container page-login">
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Viewer">Viewer</option>
            <option value="Manager">Manager</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Sign Up</button>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
};

const DashboardPage = () => {
  const [models, setModels] = useState([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await api.get('/api/models');
        setModels(res.data);
      } catch (error) {
        console.error('Failed to fetch models', error);
      }
    };
    fetchModels();
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome! Select a model to view its data.</p>
      <div className="sidebar">
        <h3>Models</h3>
        <ul>
          {models.map((model) => (
            <li key={model.name}>
              <Link to={`/data/${model.name}`}>{model.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// --- Model Builder Page (Admin) ---
const ModelBuilderPage = () => {
  const [modelName, setModelName] = useState('');
  const [fields, setFields] = useState([
    { name: '', type: 'string', required: false },
  ]);
  const [rbac, setRbac] = useState({
    Admin: ['all'],
    Manager: ['read', 'create', 'update'],
    Viewer: ['read'],
  });

  const navigate = useNavigate();

  const handleAddField = () => {
    setFields([...fields, { name: '', type: 'string', required: false }]);
  };

  const handleFieldChange = (index, e) => {
    const newFields = [...fields];
    const { name, value, type, checked } = e.target;
    newFields[index][name] = type === 'checkbox' ? checked : value;
    setFields(newFields);
  };

  const handleRbacChange = (role, action, isChecked) => {
    const newRbac = { ...rbac };
    const permissions = newSet(newRbac[role]);
    if (isChecked) {
      permissions.add(action);
    } else {
      permissions.delete(action);
    }
    newRbac[role] = Array.from(permissions);
    setRbac(newRbac);
  };
  
  // Helper for React <18 compatibility with Set
  const newSet = (arr) => new Set(arr);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const modelConfig = {
      name: modelName,
      fields: fields.filter(f => f.name), // Filter out empty fields
      rbac,
    };
    try {
      await api.post('/api/models/publish', modelConfig);
      alert(`Model "${modelName}" published successfully!`);
      navigate(`/data/${modelName}`);
    } catch (error) {
      console.error('Failed to publish model', error);
      alert(`Error: ${error.response?.data || error.message}`);
    }
  };

  const rbacActions = ['create', 'read', 'update', 'delete', 'all'];

  return (
    <div className="container page-builder">
      <h2>Model Builder</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-group">
          <label>Model Name</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="e.g., Product"
            required
          />
        </div>

        <hr />
        <h3>Fields</h3>
        {fields.map((field, index) => (
          <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              name="name"
              type="text"
              value={field.name}
              onChange={(e) => handleFieldChange(index, e)}
              placeholder="Field Name"
            />
            <select
              name="type"
              value={field.type}
              onChange={(e) => handleFieldChange(index, e)}
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
            </select>
            <label>
              <input
                name="required"
                type="checkbox"
                checked={field.required}
                onChange={(e) => handleFieldChange(index, e)}
              />
              Required
            </label>
          </div>
        ))}
        <button type="button" className="secondary" onClick={handleAddField}>
          + Add Field
        </button>

        <hr />
        <h3>Role-Based Access Control (RBAC)</h3>
        {Object.keys(rbac).map((role) => (
          <div key={role} className="form-group">
            <label>{role}</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {rbacActions.map((action) => (
                <label key={action}>
                  <input
                    type="checkbox"
                    checked={rbac[role].includes(action)}
                    onChange={(e) => handleRbacChange(role, action, e.target.checked)}
                  />
                  {action}
                </label>
              ))}
            </div>
          </div>
        ))}

        <hr />
        <button type="submit">Publish Model</button>
      </form>
    </div>
  );
};

// --- Data Management Page (Dynamic) ---
const DataManagementPage = () => {
  const { modelName } = useParams();
  const [schema, setSchema] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const { user } = useAuth();

  // Check user permissions
  const can = (action) => {
    if (!schema || !user) return false;
    const permissions = schema.rbac[user.role];
    return permissions && (permissions.includes(action) || permissions.includes('all'));
  };
  
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch schema
      const schemaRes = await api.get(`/api/models/${modelName}`);
      setSchema(schemaRes.data);

      // Fetch data
      const dataRes = await api.get(`/api/${modelName.toLowerCase()}`);
      setData(dataRes.data);
    } catch (err) {
      setError(`Failed to load data. ${err.response?.data || err.message}`);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchData();
  }, [modelName]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await api.delete(`/api/${modelName.toLowerCase()}/${id}`);
        fetchData(); // Refresh data
      } catch (err) {
        alert(`Error: ${err.response?.data || err.message}`);
      }
    }
  };
  
  const handleOpenForm = (item = null) => {
    setEditingItem(item);
    setShowForm(true);
  };
  
  const handleCloseForm = () => {
    setEditingItem(null);
    setShowForm(false);
    fetchData(); // Refresh data after form close
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!schema) return <div>Model schema not found.</div>;

  const headers = schema.fields.map((f) => f.name).concat(['createdAt', 'updatedAt', 'actions']);

  return (
    <div className="page-data">
      <h2>Manage {schema.name}</h2>
      
      {can('create') && !showForm && (
        <button onClick={() => handleOpenForm()}>+ Add New</button>
      )}
      
      {showForm && (
        <DynamicForm 
          schema={schema} 
          item={editingItem} 
          onClose={handleCloseForm}
        />
      )}
      
      {!showForm && (
        <table>
          <thead>
            <tr>
              {headers.map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                {schema.fields.map((field) => (
                  <td key={field.name}>
                    {field.type === 'boolean' ? String(item[field.name]) : item[field.name]}
                  </td>
                ))}
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td>{new Date(item.updatedAt).toLocaleString()}</td>
                <td>
                  {can('update') && (
                    <button className="secondary" onClick={() => handleOpenForm(item)}>Edit</button>
                  )}
                  {' '}
                  {can('delete') && (
                    <button className="danger" onClick={() => handleDelete(item.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// --- Dynamic Form Component ---
const DynamicForm = ({ schema, item, onClose }) => {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    // Pre-fill form if we are editing
    if (item) {
      const initialData = {};
      schema.fields.forEach(field => {
        initialData[field.name] = item[field.name] ?? '';
      });
      setFormData(initialData);
    } else {
      // Set defaults for new item
      const initialData = {};
      schema.fields.forEach(field => {
        initialData[field.name] = field.default ?? (field.type === 'boolean' ? false : '');
      });
      setFormData(initialData);
    }
  }, [schema, item]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Convert numbers
    const payload = { ...formData };
    schema.fields.forEach(field => {
      if (field.type === 'number' && payload[field.name] !== '') {
        payload[field.name] = parseFloat(payload[field.name]);
      }
    });

    try {
      if (item) {
        // Update
        await api.put(`/api/${schema.name.toLowerCase()}/${item.id}`, payload);
      } else {
        // Create
        await api.post(`/api/${schema.name.toLowerCase()}`, payload);
      }
      onClose(); // Close form and trigger refresh
    } catch (err) {
      setError(`Error: ${err.response?.data || err.message}`);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem', borderRadius: '8px' }}>
      <h3>{item ? `Edit ${schema.name}` : `New ${schema.name}`}</h3>
      <form onSubmit={handleSubmit} className="form-grid">
        {schema.fields.map(field => (
          <div className="form-group" key={field.name}>
            <label>{field.name} {field.required && '*'}</label>
            {field.type === 'boolean' ? (
              <input
                name={field.name}
                type="checkbox"
                checked={!!formData[field.name]}
                onChange={handleChange}
              />
            ) : (
              <input
                name={field.name}
                type={field.type === 'number' ? 'number' : 'text'}
                value={formData[field.name] ?? ''}
                onChange={handleChange}
                required={field.required}
              />
            )}
          </div>
        ))}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit">{item ? 'Update' : 'Create'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

// --- Main App Component ---
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;