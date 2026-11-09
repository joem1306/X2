# Validation de X2

## Automatisation

Prérequis : Node.js 20+ (24 utilisé ici), Python 3, Chromium et les outils Poppler `pdftotext` / `pdfinfo`. Installer ces outils par les canaux de confiance de votre système. Playwright est uniquement une dépendance de développement, absente des scripts et du cache de l’application.

```sh
cd /workspace/X2
npm ci --cache /tmp/x2-npm-cache
npm test
npm run test:e2e
```

`npm test` utilise `node:test` sans navigateur. `npm run test:e2e` démarre un serveur local Python sur le parent du checkout pour reproduire `/X2/`, puis Chromium avec un écran 390 × 844, une locale française et Europe/Paris. Le dossier du checkout doit s’appeler `X2`. Le navigateur système est `/usr/bin/chromium` ; pour un autre emplacement :

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/chemin/vers/chromium npm run test:e2e
```

Le projet ne télécharge pas de navigateur lors de l’installation npm. Les sorties générées (PDF synthétiques, rapports d’erreur) vont dans `test-results/`, ignoré par Git. Ne pas remplacer les fixtures par des données personnelles.

### Couverture

- Trois dates non consécutives, doublon de date refusé, début, fin, réouverture, correction de date sans effacement.
- Création / modification / suppression et rechargement des entrées ; aucun préréglage de volume ; envie absente conservée comme `null`.
- Ordre par instant, égalités stables, passage de minuit, réordonnancement et recalcul après modification.
- Coucher 22:15 → miction 03:10 → réveil 06:50 → première miction 07:00 : **1** lever nocturne. Bornes exactes testées séparément.
- Volume nocturne avec la première miction du matin incluse une fois ; repères manquants/inversés indisponibles, première miction manquante signalée.
- UTC / heure locale, date locale près de minuit, année bissextile, heure d’été inexistante et heure d’automne répétée avec choix d’écart UTC.
- Export JSON réellement téléchargé ; restauration par le sélecteur de fichiers dans un contexte vierge ; refus des données malformées, inconnues, incohérentes, dupliquées ou trop volumineuses ; annulation de remplacement sans effet.
- Panne de stockage simulée lors de l’ajout et de la restauration : pas de succès, pas de remplacement partiel ; reprise après résolution.
- Deux fenêtres : détection de conflit avant écriture, sans perte d’une saisie déjà enregistrée.
- Service worker et ressources sous `/X2/` ; rechargement hors ligne et création / modification / suppression hors ligne. Inspection des requêtes et des corps de cache : pas de contenu des saisies. Texte ressemblant à du HTML rendu inerte.
- Mise à jour réelle du script du service worker (serveur de test, sans modifier les sources) : activation dans une autre fenêtre, conservation d’un formulaire non enregistré et des données IndexedDB.
- Rapport A4 produit par le moteur d’impression Chromium ; trois pages pour trois jours courts ; extraction de texte pour vérifier accents, colonnes, jours et totaux. Historique long sur plusieurs pages avec dernière ligne et totaux présents. Les métadonnées PDF et le nombre de pages sont vérifiés avec Poppler.
- Affichage 320 px et police de base agrandie à 150 %, formulaire sans débordement, focus sur le volume, textes utilisateur sans exécution HTML.

Ces tests couvrent Chromium desktop en émulation mobile, **pas Safari iOS réel**. La génération `page.pdf()` valide le document et sa pagination ; elle ne valide pas l’interface système d’impression d’iOS.

## Recette manuelle sur un vrai iPhone — avant données réelles

Utiliser uniquement des valeurs fictives. Effectuer les vérifications dans Safari **et** après installation sur l’écran d’accueil. Cocher les résultats, noter la version iOS et le modèle.

- [ ] La version approuvée charge à `https://joem1306.github.io/X2/` en HTTPS, sans ressource 404 ; manifeste et icône d’accueil corrects.
- [ ] Partager → Sur l’écran d’accueil ; ouverture autonome avec zones sûres, clavier et boutons accessibles. Aucun contrôle masqué par le clavier.
- [ ] Attendre « Disponible hors ligne », activer le mode avion, fermer complètement puis relancer. Consulter et modifier les trois journées ; refaire un lancement à froid.
- [ ] Trois dates espacées ; saisie à 23:50 et 00:10 rattachée au même jour sélectionné. La sélection survit au relancement.
- [ ] Saisir et corriger coucher/réveil, nuit et première miction du matin ; vérifier l’ordre et les étiquettes. Tester les deux heures répétées d’automne si pertinent, ou via un appareil/simulateur configuré.
- [ ] Fin/réouverture, modifications, suppression confirmée et annulée. Date de jour corrigée sans perte des anciennes heures.
- [ ] Export JSON vers Fichiers, vérifier le fichier ; restaurer et comparer toutes les saisies. Annuler un remplacement. Essayer un fichier invalide ; le journal reste identique.
- [ ] PDF : agrandir l’aperçu d’impression puis enregistrer un seul PDF. Vérifier les trois jours, toutes les lignes, les accents, les totaux, une longue remarque et les débordements. Annuler puis réessayer. Vérifier que Safari n’ajoute pas d’en-têtes/URL superflus ; les désactiver si le dialogue le permet.
- [ ] Comparer visuellement les colonnes et la hiérarchie à l’original papier (image originale non fournie avec les spécifications). Faire confirmer la convention du volume nocturne et la fenêtre de 24 h par le médecin.
- [ ] Augmenter taille du texte / zoom iOS ; tester paysage et portrait, VoiceOver (libellés, ordre, fenêtres, retour du focus) et navigation clavier si disponible.
- [ ] Inspecteur Web Safari : les seules connexions concernent les ressources statiques. Aucune entrée ou note dans les requêtes, URL, console, Cache Storage. Aucun compte, CDN ou tracker.
- [ ] Nouvelle version approuvée : notification, pas de rechargement pendant la saisie, activation explicite après fermeture du formulaire ; données conservées après relancement hors ligne. Sauvegarder avant ce test.
- [ ] Tester un stockage refusé/saturé si possible : message explicite, formulaire conservé, pas de confirmation mensongère. Ne pas provoquer la perte d’un journal réel pour ce test.

## Revue avant livraison

Contrôler les appels réseau de `sw.js` (seulement ressources statiques précachées), la CSP, l’absence de dépendances distantes, l’incrément de version du cache et `git diff --check`. Vérifier `git status` pour éviter d’inclure des exports ou profils de navigateur. La publication est une action séparée qui requiert l’approbation du propriétaire.
