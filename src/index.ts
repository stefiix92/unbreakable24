import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());  // To parse JSON request bodies

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI!).then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Middleware to validate API key
function validateApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === process.env.API_KEY!) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Invalid API Key' });
    }
}

// Schema for Location
const locationSchema = new mongoose.Schema({
    latitude: Number!,
    longitude: Number!,
    distance: Number!,
    timestamp: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
    startTime: { type: Date, default: Date.now },
    endTime: Date
});

// Location model
const Location = mongoose.model('Location', locationSchema);
const Session = mongoose.model('Session', sessionSchema);

// Endpoint to receive location updates
app.post('/update-location', validateApiKey, async (req, res) => {
    const currentSession = await Session.findOne().sort({ startTime: -1 });
    if (!currentSession) {
        return res.status(400).send({ message: 'No active session found' });
    }
    const { latitude, longitude } = req.body;
    if (latitude === null || longitude === null) {
        return res.status(400).send({ message: 'Latitude and Longitude are required' });
    }
    const locationModel = new Location({ latitude, longitude, distance: 0 });
    const previousLocation = await Location.findOne().sort({ timestamp: -1 });
    if (previousLocation) {
        const distance = Math.sqrt(
            Math.pow(latitude - previousLocation.latitude!, 4) +
            Math.pow(longitude - previousLocation.longitude!, 4)
        );
        locationModel.distance = distance;
    }
    locationModel.save().then(() => {
        res.status(200).send({ message: 'Location updated successfully' });
    }).catch(err => {
        console.log('Error:', err);
    });
});

app.get('/get-location', (req, res) => {
    // Get the latest location from the database
    Location.findOne().sort({ timestamp: -1 }).then(location => {
        res.status(200).send(location);
    }).catch(err => {
        console.log('Error:', err);
        res.status(500).send({ message: 'Internal Server Error'} );
    });
});

app.post('/start-session', validateApiKey, async(req, res) => {
    // Start a new session
    const existingSession = await Session.findOne().sort({ startTime: -1 });
    if (existingSession) {
        return res.status(400).send({ message: 'An active session already exists' });
    }
    const sessionModel = new Session();
    sessionModel.save().then(() => {
        res.status(200).send({ message: 'Session started successfully' });
    }).catch(err => {
        console.log('Error:', err);
    });
});

app.get('/get-session', validateApiKey, (req, res) => {
    // Get the current session
    Session.findOne().sort({ startTime: -1 }).then(session => {
        res.status(200).send(session);
    }).catch(err => {
        console.log('Error:', err);
    });
});

app.post('/end-session', validateApiKey, (req, res) => {
    // End the current session
    Session.findOne().sort({ startTime: -1 }).then(session => {
        session!.endTime = new Date();
        session!.save().then(() => {
            res.status(200).send({ message: 'Session ended successfully' });
        }).catch(err => {
            console.log('Error:', err);
        });
    }).catch(err => {
        console.log('Error:', err);
    });
});

app.post('/wipe-data', validateApiKey, (req, res) => {
    // Wipe all data
    if (req.body.confirm !== 'CONFIRM') {
        return res.status(400).send({ message: 'Confirmation string is required' });
    }
    
    Location.deleteMany().then(async () => {
        await Session.deleteMany();
        res.status(200).send({ message: 'Data wiped successfully' });
    }).catch(err => {
        console.log('Error:', err);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
