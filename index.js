import 'dotenv/config';
import { ObjectId } from 'mongodb';
import express from 'express';
import { MongoClient } from 'mongodb';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));



export async function connectToMongoDB(uri) {
    let mongoClient;

    try {
        mongoClient = new MongoClient(uri);
        console.log('Connecting to MongoDB...');
        await mongoClient.connect();
        console.log('Successfully connected to MongoDB!');

        return mongoClient;
    } catch (error) {
        console.error('Connection to MongoDB failed!', error);
        process.exit();
    }
}

async function getPokemon(page = 1) {
    let mongoClient;
    let tousLesPokemons;
    const numbToSkip = page - 1
    const numbToLimit = 10
    try {
        mongoClient = await connectToMongoDB(process.env.DB_URI);
        const mediaDb = mongoClient.db('media');
        const pokemons = mediaDb.collection('pokemon');
        tousLesPokemons = await pokemons.find().skip(numbToLimit * numbToSkip).limit(numbToLimit).toArray();
    } finally {
        mongoClient.close(); 
    }

    return tousLesPokemons;
}
// Acceuil
app.get('/', (req, res) => {
    res.send('Acceuil');
});

// CRUD pokemon 

// Lister tous les pokemons
app.get('/pokemons', async (req, res) => {
    const page = req.query.page;
    console.log(page);

    const tousLesPokemons = await getPokemon(page);
    res.json(tousLesPokemons);
});



// Port d'écoute

app.listen(process.env.PORT, () => {
    console.log(`serveur lancé sur le port ${process.env.PORT}`);
});