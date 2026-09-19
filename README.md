# Bird Slow — Xeno-canto × RNBO × GitHub Pages

Petit site statique qui :

1. charge un export Web RNBO ;
2. demande à Xeno-canto une sélection d'enregistrements d'oiseaux identifiés comme des chants ;
3. choisit un enregistrement au hasard ;
4. récupère temporairement le fichier audio en mémoire dans le navigateur ;
5. le décode avec Web Audio ;
6. l'envoie directement dans un `buffer~` RNBO via `device.setDataBuffer()` ;
7. expose automatiquement les paramètres RNBO dans l'interface.

RNBO documente `setDataBuffer(id, AudioBuffer)` pour remplir un DataBuffer depuis le navigateur, et le buffer est copié dans le device RNBO. Le fichier n'est donc pas écrit sur le disque du serveur. Voir la documentation RNBO : https://rnbo.cycling74.com/learn/buffers-and-file-dependencies

## 1. Exporter ton patch RNBO

Dans Max :

- ouvre le panneau Export ;
- choisis **Web Export** ;
- exporte ton patch ;
- place le fichier JSON exporté dans ce dossier ;
- renomme-le :

`patch.export.json`

ou change `RNBO_PATCH_URL` dans `config.js`.

Dans ton patch RNBO, crée un buffer :

`[buffer~ bird]`

et utilise-le avec ton système de lecture / ralentissement.

Le nom `bird` doit correspondre à :

`RNBO_BUFFER_ID: "bird"`

Si ton buffer porte un autre nom, change cette valeur.

## 2. Paramètres RNBO

Les paramètres exposés par le device RNBO sont récupérés automatiquement par JavaScript.

Le script crée un slider pour chacun d'eux.

Pour le slider global "Vitesse", si ton paramètre RNBO s'appelle par exemple :

`speed`

ajoute dans `config.js` :

`SPEED_PARAM_ID: "speed"`

Tu peux alors faire correspondre le slider à ton paramètre RNBO.

## 3. Xeno-canto

L'API Xeno-canto v3 nécessite actuellement une clé API.

La clé peut être obtenue depuis ton compte Xeno-canto.

### Test rapide

Le site te demande actuellement la clé au clic sur "Random bird". Elle n'est pas enregistrée.

C'est pratique pour tester le prototype, mais ce n'est pas idéal pour un site public.

## 4. Site public : utiliser le Worker

GitHub Pages ne peut pas cacher une clé API car tout son contenu est public.

Le dossier contient donc `worker.js`, destiné à Cloudflare Workers.

Le Worker fait deux choses :

`/api`
→ appelle Xeno-canto avec la clé secrète.

`/audio`
→ récupère le fichier audio Xeno-canto et le retransmet au navigateur avec CORS.

### Déployer le Worker

Crée un Worker Cloudflare avec `worker.js`.

Ajoute une variable secrète :

`XENO_API_KEY`

avec ta clé Xeno-canto.

Puis modifie `config.js` :

```js
XENO_API_PROXY:
  "https://TON-WORKER.workers.dev/api",

AUDIO_PROXY:
  "https://TON-WORKER.workers.dev/audio?url=",
```

Et tu n'auras plus besoin de demander la clé dans l'interface.

## 5. GitHub Pages

Structure minimale :

```text
/
├── index.html
├── app.js
├── config.js
├── style.css
├── patch.export.json
├── README.md
└── worker.js
```

Crée un repository GitHub, pousse ces fichiers puis active :

Settings
→ Pages
→ Deploy from branch
→ main
→ / (root)

## 6. Important : CORS

Deux accès réseau doivent fonctionner :

```text
GitHub Pages
    ↓
Xeno-canto API
```

et

```text
GitHub Pages
    ↓
fichier audio Xeno-canto
```

Si l'un des deux est bloqué par CORS, utilise le Worker fourni.

## 7. Architecture audio

```text
Xeno-canto API
       │
       │ metadata
       ▼
 random recording
       │
       │ file URL
       ▼
 fetch()
       │
       ▼
 ArrayBuffer
       │
       ▼
 decodeAudioData()
       │
       ▼
 Web Audio AudioBuffer
       │
       ▼
 RNBO setDataBuffer()
       │
       ▼
 [buffer~ bird]
       │
       ▼
 ton algorithme de ralentissement RNBO
```

Le MP3 n'est jamais enregistré comme fichier dans GitHub Pages.

## 8. Attention aux licences

Chaque enregistrement Xeno-canto possède ses propres informations de licence et d'attribution. Le site affiche un lien vers la fiche Xeno-canto de l'enregistrement sélectionné.

Pour une publication réelle, vérifie la licence de chaque enregistrement que tu utilises et affiche l'attribution requise.

## 9. Si tu veux vraiment cibler les "songbirds"

La requête actuelle est :

`grp:birds type:song`

Cela sélectionne les enregistrements d'oiseaux dont le type est identifié comme "song".

"Songbird" au sens taxonomique (principalement les Passeriformes / oscines) est une notion différente.

Pour commencer, ce filtre est volontairement plus large. On pourra ensuite faire une vraie liste taxonomique des espèces de passereaux et l'utiliser pour sélectionner uniquement celles-ci.
