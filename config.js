/*
 * CONFIGURATION
 *
 * 1. Mets ton export RNBO Web dans le même dossier que ce fichier.
 * 2. Donne-lui le nom indiqué ci-dessous, ou change RNBO_PATCH_URL.
 *
 * IMPORTANT :
 * L'API Xeno-canto v3 nécessite actuellement une clé API.
 * Ne mets PAS ta clé dans ce fichier si ce dépôt est public.
 * Utilise plutôt le champ prévu dans l'interface, ou un proxy serveur
 * (voir worker.js / README.md).
 */

window.BIRD_RNBO_CONFIG = {
  RNBO_PATCH_URL: "./patch.export.json",

  // Nom du buffer~ dans ton patch RNBO.
  // Si null, le premier DataBuffer trouvé sera utilisé.
  RNBO_BUFFER_ID: "bird",

  // Xeno-canto
  XENO_API_URL: "https://xeno-canto.org/api/3/recordings",

  // Requête par défaut : enregistrements d'oiseaux identifiés comme "song".
  // Tu peux modifier cette requête dans l'interface de app.js.
  XENO_QUERY: 'grp:birds type:song',

  // Pour une vraie mise en ligne publique, préfère un proxy.
  // Laisse vide pour le mode direct.
  XENO_API_PROXY: "",

  // Même principe pour le fichier audio si le serveur audio refuse CORS.
  // Exemple : "https://ton-worker.example.workers.dev/audio?url="
  AUDIO_PROXY: "",

  // Nombre maximal de pages consultées lorsque l'on cherche un résultat
  // aléatoire. Les résultats sont échantillonnés sans tout télécharger.
  RANDOM_MAX_PAGES: 20
};
