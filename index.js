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

// Avoir un pokemon par son id
app.get('/pokemons/:id', async (req, res) => {
  const { id } = req.params;

  // Vérifie que l'ID est un ObjectId valide
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID invalide" });
  }

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemons = mediaDb.collection('pokemon');

    const pokemon = await pokemons.findOne({ _id: new ObjectId(id) });

    if (!pokemon) {
      return res.status(404).json({ error: "Aucun Pokémon trouvé avec cet ID" });
    }

    res.json(pokemon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});

// Avoir un pokemon par son type
app.get('/type/:type', async (req, res) => {
    const type = req.params.type;
    let mongoClient;
    let unPokemon;
    try {
        mongoClient = await connectToMongoDB(process.env.DB_URI);
        const mediaDb = mongoClient.db('media');
        const pokemons = mediaDb.collection('pokemon');
        unPokemon = await pokemons.find({ type: type }).toArray();
    } finally {
        mongoClient.close(); 
    }

    res.json(unPokemon);
});

// Filtrer les pokemons par un nombre minimum de type
app.get('/with-min-types/:min', async (req, res) => {
  const min = parseInt(req.params.min);

  if (isNaN(min)) {
    return res.status(400).json({ error: "Le paramètre doit être un nombre." });
  }

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemonsCollection = mediaDb.collection('pokemon');

    const allPokemons = await pokemonsCollection.find().toArray();
    const filtered = allPokemons.filter(pokemon =>
      Array.isArray(pokemon.type) && pokemon.type.length >= min
    );

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});


// Filtrer les pokemons par nom en anglais et type avec agrégation
app.get('/filter', async (req, res) => {
  const name = req.query.name; // Récupère le nom en anglais
  const type = req.query.type; // Récupère le type

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemonsCollection = mediaDb.collection('pokemon');

    // Définir le pipeline d'agrégation
    const pipeline = [];

    // Ajouter le filtre par nom en anglais (si paramètre `name` est fourni)
    if (name) {
      pipeline.push({
        $match: { 
          "name.english": { $regex: name, $options: 'i' } // Filtrer par nom en anglais (insensible à la casse)
        }
      });
    }

    // Ajouter le filtre par type (si paramètre `type` est fourni)
    if (type) {
      pipeline.push({
        $match: { 
          type: { $regex: type, $options: 'i' } // Filtrer par type (insensible à la casse)
        }
      });
    }

    // Exécuter l'agrégation
    const filteredPokemons = await pokemonsCollection.aggregate(pipeline).toArray();

    if (filteredPokemons.length === 0) {
      return res.status(404).json({ message: "Aucun Pokémon trouvé avec ces critères." });
    }

    res.json(filteredPokemons);
  } catch (err) {
    console.error(err); // Affichage de l'erreur dans la console pour diagnostiquer
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});

// Pokemon les plus lourd
app.get('/top-weight', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  if (isNaN(limit) || limit <= 0) {
    return res.status(400).json({ error: "Le paramètre 'limit' doit être un entier positif." });
  }

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemons = mediaDb.collection('pokemon');

    const pipeline = [
      { $match: { "profile.weight": { $exists: true, $ne: null } } },
      { $sort: { "profile.weight" : -1 } },
      { $limit: limit }
    ];

    const result = await pokemons.aggregate(pipeline).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});

// Pokemon les plus grands
app.get('/top-height', async (req, res) => {
  const limit = parseInt(req.query.limit) || 4;

  if (isNaN(limit) || limit <= 0) {
    return res.status(400).json({ error: "Le paramètre 'limit' doit être un entier positif." });
  }

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemons = mediaDb.collection('pokemon');

    const pipeline = [
      { $match: { "profile.height": { $exists: true, $ne: null } } },
      { $sort: { "profile.height" : -1 } },
      { $limit: limit }
    ];

    const result = await pokemons.aggregate(pipeline).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});

// Pokemon sans évolution
app.get('/without-evolution', async (req, res) => {
  const typesQuery = req.query.types;

  if (!typesQuery) {
    return res.status(400).json({ error: "Le paramètre 'types' est requis (ex: ?types=Ground,Rock)." });
  }

  const typesArray = typesQuery.split(',').map(type => type.trim());

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemons = mediaDb.collection('pokemon');

    const result = await pokemons.aggregate([
      {
        $match: {
          type: { $in: typesArray },
          $or: [
            { "evolution.next": { $exists: false } },
            { "evolution.next": { $size: 0 } }
          ]
        }
      }
    ]).toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});

// Les noms francais les plus longs
app.get('/top-french-name-length', async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;

  if (isNaN(limit) || limit <= 0) {
    return res.status(400).json({ error: "Le paramètre 'limit' doit être un nombre positif." });
  }

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemons = mediaDb.collection('pokemon');

    const result = await pokemons.aggregate([
      {
        $addFields: {
          nameLength: { $strLenCP: "$name.french" }
        }
      },
      {
        $sort: { nameLength: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 0,
          name: "$name.french",
          nameLength: 1
        }
      }
    ]).toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});

// Avoir la moyenne des points de vie de tous les pokemons
app.get('/stats/hp/average', async (req, res) => {
  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemons = mediaDb.collection('pokemon');

    const result = await pokemons.aggregate([
      {
        $group: {
          _id: null,
          averageHp: { $avg: "$base.HP" }
        }
      },
      {
        $project: {
          _id: 0,
          averageHp: { $round: ["$averageHp", 2] } // arrondi à 2 décimales
        }
      }
    ]).toArray();

    res.json(result[0]); // on renvoie l'objet directement
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});

// Avoir le type de pokemon le plus fréquent
app.get('/stats/types/top', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  if (isNaN(limit) || limit < 1) {
    return res.status(400).json({ error: "Le paramètre 'limit' doit être un entier supérieur à 0." });
  }

  let mongoClient;
  try {
    mongoClient = await connectToMongoDB(process.env.DB_URI);
    const mediaDb = mongoClient.db('media');
    const pokemons = mediaDb.collection('pokemon');

    const result = await pokemons.aggregate([
      { $unwind: "$type" },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          type: "$_id",
          count: 1
        }
      }
    ]).toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) mongoClient.close();
  }
});


// Port d'écoute

app.listen(process.env.PORT, () => {
    console.log(`serveur lancé sur le port ${process.env.PORT}`);
});