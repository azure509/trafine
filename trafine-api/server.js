const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 8080;

// Utilisez body-parser pour gérer le JSON dans le corps des requêtes
app.use(bodyParser.json());

// Une "base de données" temporaire en mémoire pour stocker les utilisateurs
const users = [];

// Endpoint pour l'inscription
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  // Vérifier si l'utilisateur existe déjà
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists' });
  }
  
  try {
    // Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    // Stockage de l'utilisateur
    users.push({ username, password: hashedPassword });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Endpoint pour la connexion
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  // Rechercher l'utilisateur dans la "base de données"
  const user = users.find(user => user.username === username);
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  
  try {
    // Comparaison du mot de passe envoyé avec le mot de passe haché stocké
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Génération du token (remplacez 'secretKey' par une clé secrète plus robuste en production)
    const token = jwt.sign({ username: user.username }, 'secretKey', { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error during login' });
  }
});

// Middleware pour protéger les routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // Le token est envoyé dans le header Authorization sous la forme "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, 'secretKey', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Exemple d'endpoint protégé
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is protected data.', user: req.user });
});

// Endpoint de base pour l'API
app.get('/', (req, res) => {
  res.send('Hello from Trafine API');
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
