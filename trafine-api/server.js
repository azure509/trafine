const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const QRCode = require('qrcode');

const app = express();
const port = 8080;

// Configuration de votre token secret Mapbox (à stocker dans une variable d'environnement en production)
const MAPBOX_SECRET_TOKEN = process.env.MAPBOX_SECRET_TOKEN || 'sk.eyJ1IjoiNHByb2oiLCJhIjoiY204Ym84anlsMWllbTJuczc1YXo0anl5NCJ9.RsHFRpOuVav_F2aPF2boyw';

// Clé secrète pour JWT (à sécuriser et stocker dans une variable d'environnement)
const JWT_SECRET = process.env.JWT_SECRET || 'secretKey';

// Utiliser body-parser pour gérer le JSON dans le corps des requêtes
app.use(bodyParser.json());

// Stockage en mémoire pour simplifier (à remplacer par une base de données)
const users = [];
const incidents = [];  // Stocke les incidents signalés

// ---------------------
// AUTHENTIFICATION
// ---------------------

// Endpoint pour l'inscription
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Endpoint pour la connexion
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(user => user.username === username);
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  
  try {
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error during login' });
  }
});

// Middleware pour protéger les routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ---------------------
// NAVIGATION ET ITINÉRAIRE VIA MAPBOX
// ---------------------

// Endpoint pour récupérer un itinéraire via Mapbox
// Exemple d'utilisation : GET /route?origin=lon1,lat1&destination=lon2,lat2
app.get('/route', async (req, res) => {
  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination query parameters are required (format: lon,lat)' });
  }
  
  try {
    const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${destination}?access_token=${MAPBOX_SECRET_TOKEN}&geometries=geojson`;
    const response = await axios.get(mapboxUrl);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving route from Mapbox', details: error.message });
  }
});

// ---------------------
// GESTION DES INCIDENTS
// ---------------------

// Endpoint pour signaler un incident (protégé)
app.post('/incident', authenticateToken, (req, res) => {
  const { type, location, description } = req.body;
  if (!type || !location) {
    return res.status(400).json({ error: 'type and location are required' });
  }
  
  // Création d'un incident avec un identifiant unique simple
  const incident = {
    id: incidents.length + 1,
    type,
    location,  // Attendu sous la forme "lon,lat"
    description: description || '',
    reportedBy: req.user.username,
    votes: 0,  // Score de validation par la communauté
    timestamp: new Date()
  };
  incidents.push(incident);
  res.status(201).json({ message: 'Incident reported', incident });
});

// Endpoint pour consulter tous les incidents (public ou protégé selon vos besoins)
app.get('/incident', (req, res) => {
  res.json(incidents);
});

// Endpoint pour voter sur un incident (validation/invalidation)
// Exemple : POST /incident/vote avec { incidentId: 1, vote: 1 } (vote peut être +1 ou -1)
app.post('/incident/vote', authenticateToken, (req, res) => {
  const { incidentId, vote } = req.body;
  const incident = incidents.find(inc => inc.id === incidentId);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  if (![1, -1].includes(vote)) {
    return res.status(400).json({ error: 'Vote must be +1 or -1' });
  }
  incident.votes += vote;
  res.json({ message: 'Vote recorded', incident });
});

// ---------------------
// PARTAGE D'ITINÉRAIRE VIA QR CODE
// ---------------------

// Endpoint pour générer un QR code à partir d'un itinéraire (ou d'une URL d'itinéraire)
// Exemple : GET /itinerary/qr?url=<url>
app.get('/itinerary/qr', (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }
  
  QRCode.toDataURL(url, (err, qrCodeUrl) => {
    if (err) {
      return res.status(500).json({ error: 'Error generating QR code', details: err.message });
    }
    res.json({ qrCodeUrl });
  });
});

// ---------------------
// ROUTES D'EXEMPLE
// ---------------------

// Endpoint de base pour l'API
app.get('/', (req, res) => {
  res.send('Hello from Trafine API');
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
