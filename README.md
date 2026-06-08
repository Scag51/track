# Trackr by Equinoxes

**Application PWA multi-tenant de suivi d'origine clients**
Développé par [Equinoxes](https://equinoxes.fr) — Agence web, Reims

---

## Architecture multi-tenant

### 3 niveaux d'accès

| Rôle | Accès | Usage |
|------|-------|-------|
| `superadmin` | Tout | Equinoxes (Clément) — gestion de tous les clients |
| `admin` | Son client uniquement | Direction du client (ex: Feuillâtre) — dashboard + saisie |
| `staff` | Saisie uniquement | Vendeuses — formulaire de saisie |

### Flux Equinoxes

1. Equinoxes crée un nouveau client via l'interface superadmin
2. Configure les magasins et les sources media
3. Crée le compte admin client (direction)
4. La direction crée les comptes vendeuses
5. Chaque vendeuse se connecte et saisit

---

## Déploiement sur Coolify (VPS OVH)

### 1. Préparer le repo GitHub

```bash
cd trackr-app
git init
git add .
git commit -m "Initial commit – Trackr by Equinoxes"
git remote add origin https://github.com/equinoxes/trackr.git
git push -u origin main
```

### 2. Dans Coolify

1. **New Resource** → **Docker Compose**
2. Connecter le repo GitHub
3. Sélectionner la branche `main`

### 3. Variables d'environnement Coolify

```
POSTGRES_USER=trackr
POSTGRES_PASSWORD=un_mot_de_passe_fort_ici
SUPERADMIN_EMAIL=admin@equinoxes.fr
SUPERADMIN_PASSWORD=votre_mot_de_passe_equinoxes
JWT_SECRET=generer_avec_openssl_rand_base64_48
```

### 4. Déployer

Cliquer **Deploy** — Coolify build les 3 containers et lance l'app.

### 5. Domaine

Configurer dans Coolify : `trackr.qoma.fr` (ou autre sous-domaine)
SSL Let's Encrypt géré automatiquement.

---

## Installation PWA (Android)

Les vendeuses n'ont PAS besoin d'installer quoi que ce soit via le Play Store.

1. Ouvrir **Chrome** sur le téléphone
2. Naviguer vers l'URL de l'app
3. Menu Chrome (⋮) → **"Ajouter à l'écran d'accueil"**
4. L'icône Trackr apparaît — se comporte comme une app native

---

## Onboarding premier client (Feuillâtre)

Se connecter en superadmin, puis **"Nouveau client"** et remplir :

- **Nom** : Bijouterie Feuillâtre
- **Points de vente** : Soissons / Villers-Cotterêts / Crépy-en-Valois
- **Sources** : N Radio / Vase de Soissons / JC Decaux / Internet / Bouche à oreille / Fidèle
- **Admin** : email direction Feuillâtre + mot de passe

Ensuite créer les comptes vendeuses depuis l'onglet détail client.

---

## Structure du projet

```
trackr-app/
├── backend/
│   ├── src/index.js       # API Express (auth, entries, stats, export)
│   ├── src/auth.js        # Middleware JWT
│   ├── db/init.js         # Schéma PostgreSQL multi-tenant
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Routing par rôle
│   │   ├── api.js                # Client HTTP
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx     # Page de connexion
│   │   │   ├── StaffApp.jsx      # Interface vendeuse
│   │   │   ├── AdminApp.jsx      # Interface admin client
│   │   │   ├── SuperAdminApp.jsx # Interface Equinoxes
│   │   │   └── SaisiePanel.jsx   # Formulaire partagé
│   │   └── components/
│   │       ├── Header.jsx        # Header commun
│   │       └── Dashboard.jsx     # Dashboard partagé
│   ├── public/manifest.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```
