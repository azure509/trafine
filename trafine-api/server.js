const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Ajout d'axios pour les requêtes HTTP

const app = express();
const port = 8080;

// Utilisez body-parser pour gérer le JSON dans le corps des requêtes
app.use(bodyParser.json());

// Une "base de données" temporaire en mémoire pour stocker les utilisateurs
const users = [];

// Clé Mapbox récupérée depuis la variable d'environnement ou valeur par défaut
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || 'sk.eyJ1IjoiNHByb2oiLCJhIjoiY204Ym84anlsMWllbTJuczc1YXo0anl5NCJ9.RsHFRpOuVav_F2aPF2boyw';

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

// --- Nouvelle fonctionnalité : Endpoint pour récupérer un itinéraire via Mapbox ---
// Exemple d'appel : GET /route?origin=lon1,lat1&destination=lon2,lat2
app.get('/route', async (req, res) => {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Les paramètres origin et destination sont requis au format lon,lat' });
  }
  
  try {
    // Construit l'URL pour appeler l'API Directions de Mapbox
    const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${destination}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;
    const response = await axios.get(mapboxUrl);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'itinéraire depuis Mapbox', details: error.message });
  }
});

// Endpoint de base pour l'API
app.get('/', (req, res) => {
  res.send('Hello from Trafine API');
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
