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

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/mongodb', (req, res) => {
    res.send("J'aime trop mongodb <3 !");
});

async function getFilms(page = 1) {
    let mongoClient;
    let tousLesFilms;
    const numbToSkip = page - 1
    const numbToLimit = 10
    try {
        mongoClient = await connectToMongoDB(process.env.DB_URI);
        const mediaDb = mongoClient.db('media');
        const films = mediaDb.collection('films');
        tousLesFilms = await films.find().skip(numbToLimit * numbToSkip).limit(numbToLimit).toArray();
    } finally {
        mongoClient.close();
    }

    return tousLesFilms;
}
// CRUD Films

// Récupérer tous les films
app.get('/films', async (req, res) => {
    const page = req.query.page;
    console.log(page);

    const tousLesFilms = await getFilms(page);
    res.json(tousLesFilms);
});

// Ajouter un film
app.post('/films', async (req, res) => {
    const nouveauFilm = req.body;
    let mongoClient;

    try {
        mongoClient = await connectToMongoDB(process.env.DB_URI);
        const mediaDb = mongoClient.db('media'); // ✅ base "media"
        const films = mediaDb.collection('films'); // ✅ collection "film"

        const resultat = await films.insertOne(nouveauFilm);
        res.status(201).json({ message: 'Film ajouté avec succès !', id: resultat.insertedId, nom: nouveauFilm.nom, realisateur: nouveauFilm.realisateur, duree: nouveauFilm.duree, genres: nouveauFilm.genres, resume: nouveauFilm.resume});
    } catch (error) {
        console.error("Erreur lors de l'ajout du film :", error);
        res.status(500).json({ message: "Erreur lors de l'ajout du film." });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
});



// Modifier un film

app.put('/films/:id', async (req, res) => {
    const filmId = req.params.id;
    const nouvellesInfos = req.body;
    let mongoClient;

    // Vérification de l'ID
    if (!ObjectId.isValid(filmId)) {
        return res.status(400).json({ message: "ID de film invalide." });
    }

    try {
        mongoClient = await connectToMongoDB(process.env.DB_URI);
        const mediaDb = mongoClient.db('media');
        const films = mediaDb.collection('films');

        // Vérifie si le film existe
        const filmExistant = await films.findOne({ _id: new ObjectId(filmId) });

        if (!filmExistant) {
            return res.status(404).json({ message: "Aucun film trouvé avec cet ID." });
        }

        // Vérifie si tous les champs envoyés existent dans le document actuel
        const champsAutorises = Object.keys(filmExistant);
        const champsInconnus = Object.keys(nouvellesInfos).filter(
            key => !champsAutorises.includes(key)
        );

        if (champsInconnus.length > 0) {
            return res.status(400).json({
                message: "Certains champs envoyés n'existent pas dans le film.",
                champsInvalides: champsInconnus
            });
        }

        const resultat = await films.updateOne(
            { _id: new ObjectId(filmId) },
            { $set: nouvellesInfos }
        );

        res.json({ message: "Film mis à jour avec succès." });

    } catch (error) {
        console.error("Erreur lors de la mise à jour du film :", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour du film." });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
});


// Supprimer un film
app.delete('/films/:id', async (req, res) => {
    const filmId = req.params.id;
    let mongoClient;

    try {
        mongoClient = await connectToMongoDB(process.env.DB_URI);
        const mediaDb = mongoClient.db('media');
        const films = mediaDb.collection('films');

        const resultat = await films.deleteOne({ _id: new ObjectId(filmId) });

        if (resultat.deletedCount === 0) {
            res.status(404).json({ message: "Aucun film trouvé avec cet ID." });
        } else {
            res.json({ message: "Film supprimé avec succès." });
        }
    } catch (error) {
        console.error("Erreur lors de la suppression du film :", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression du film." });
    } finally {
        if (mongoClient) {
            await mongoClient.close();
        }
    }
})


// Port d'écoute

app.listen(process.env.PORT, () => {
    console.log(`serveur lancé sur le port ${process.env.PORT}`);
});