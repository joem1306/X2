# X2

Journal mictionnel personnel, en français, pour trois journées consécutives ou non. PWA statique pour iPhone Safari et l’écran d’accueil. HTML, CSS et JavaScript natifs ; **aucune dépendance d’exécution, aucun serveur applicatif, aucun compte ni suivi**.

## Utilisation

Choisir Jour 1, 2 ou 3. La première saisie attribue la date locale actuelle ; « Choisir / Corriger la date » permet de la changer. Une correction de date **conserve les horodatages des événements**. Les modifier individuellement si nécessaire. Deux journées ne peuvent pas commencer à la même date.

- **Boisson** : date/heure, Eau / Café / Thé / Tisane / Autre, volume mesuré saisi manuellement. Autre peut être précisé.
- **Miction** : date/heure, volume, envie et remarques facultatives. Une envie non renseignée reste inconnue.
- **Je me couche / Je me réveille** : un coucher et un réveil **final** par journée. Un lever temporaire se note avec Miction. Toucher à nouveau un repère permet de le corriger.
- L’historique complet est sous les quatre actions. Le crayon permet de corriger ou supprimer une entrée. Les suppressions sont confirmées.
- Conserver le même jour sélectionné après minuit et pour la première miction du matin. Terminer manuellement la journée ; la rouvrir pour la corriger. La sélection du jour reste mémorisée dans IndexedDB après fermeture.
- Les volumes sont des entiers entre 1 et 10 000 ml (validation de saisie, sans interprétation médicale). Limites : 1 000 événements par jour, 500 caractères par remarque, 80 pour le nom d’une autre boisson.

## Nuit, calculs et dates

Les fonctions pures de `js/model.js` sont la source commune de l’historique et du rapport :

- Nuit : mictions **strictement après** le coucher et **strictement avant** le réveil final.
- Première miction à partir du réveil final : incluse **une seule fois dans le volume nocturne**, exclue du nombre de levers nocturnes. Elle figure avec les mictions du jour pour le décompte jour/nuit. Une miction exactement au coucher est diurne.
- Sans paire de sommeil valide, nombres jour/nuit et volume nocturne sont **indisponibles**, jamais devinés. Les volumes saisis restent totalisés. Sans première miction après réveil, le volume nocturne est explicitement provisoire.
- Les totaux portent sur **toutes les entrées rattachées au jour**, sans exclusion silencieuse. La rubrique « Total sur 24 heures » conserve l’intitulé du formulaire, mais précise qu’une durée exacte de 24 h n’est pas garantie. Tout événement hors de la date de début et du lendemain nécessite une confirmation et est annoté dans le rapport.
- Chaque entrée conserve l’instant UTC, la date/heure locale saisie, le fuseau IANA d’origine et l’écart UTC. L’ordre se fonde sur l’instant, puis l’identifiant stable. Le changement de fuseau de l’appareil ne réinterprète pas les anciennes saisies. Modifier leur heure utilise le fuseau actuel, indiqué dans le formulaire.
- Une heure inexistante au passage à l’heure d’été est refusée. Une heure répétée en automne propose les deux écarts UTC. Les dates ne sont pas dérivées de la date UTC.

Confirmer avec le médecin la convention du volume nocturne et la période attendue. X2 n’établit ni diagnostic, ni recommandation, ni score.

## PDF et sauvegardes

Options (bouton « … ») → **Exporter / imprimer le PDF** : un rapport A4 pour les trois jours, avec tableau Heure / Boisson (nature et volume) / Urines (ml) / Remarques, repères de sommeil et totaux. Une nouvelle page commence pour chaque jour ; les longues listes débordent sur des pages supplémentaires, avec en-tête de tableau répété. Un rapport avant la fin des trois jours porte la mention provisoire.

Conformément à la spécification technique, le PDF est produit **localement par l’impression native**, sans bibliothèque ni service PDF. Sur iPhone : « Imprimer / enregistrer en PDF », agrandir l’aperçu avec deux doigts, puis Partager → Enregistrer dans Fichiers. Vérifier ce parcours dans Safari et en mode installé sur un vrai iPhone : il dépend de la version d’iOS. Aucun téléchargement PDF silencieux n’est promis. L’annulation ne change pas le journal.

**Sauvegarder JSON** télécharge une copie UTF-8 versionnée des trois jours. **Restaurer JSON** valide le contenu et affiche un résumé, puis exige une confirmation de remplacement. Limite 16 Mo. Version inconnue, dates incohérentes, identifiants dupliqués, types invalides et champs inconnus sont refusés avant toute écriture. Une transaction unique remplace le journal entier ; tout échec conserve le précédent.

Les fichiers JSON/PDF sont **en clair**. Choisir leur destination avec soin ; Fichiers/iCloud peut synchroniser un fichier selon vos réglages. X2 ne téléverse rien lui-même.

## Vie privée et stockage

IndexedDB `x2-diary`, version 1, magasin `records` : un document validé et une révision pour des écritures atomiques et la détection des conflits entre fenêtres. La sélection du jour est un enregistrement séparé. Les marqueurs de sommeil sont des événements, afin de partager l’édition et le tri ; il s’agit d’une normalisation du schéma illustratif de la spécification.

Aucune donnée médicale dans localStorage, les URL, les requêtes réseau, les journaux console ou Cache Storage. L’interface utilise les API DOM et `textContent` pour les textes saisis. CSP restrictive ; scripts, styles, icônes et police système restent locaux. Les seules requêtes d’exécution concernent les fichiers statiques de l’application et son service worker. GitHub reçoit les demandes de fichiers du site, **pas les saisies**.

Le stockage n’est pas chiffré par X2 et peut être supprimé par iOS, le navigateur ou l’utilisateur. Les erreurs ne valident jamais une saisie et encouragent l’export de la copie encore disponible. « À savoir » propose une demande de stockage persistant si le navigateur la prend en charge ; ce n’est pas une garantie. Sauvegarder régulièrement. Si le stockage est effacé, seule une sauvegarde personnelle permet une restauration. Une base illisible n’est pas automatiquement écrasée.

GitHub Pages partage l’origine `joem1306.github.io` avec les autres projets Pages de ce compte : les chemins `/X2/` ne constituent pas une isolation de sécurité du stockage. Éviter d’héberger du code non fiable sur cette même origine. L’appareil déverrouillé et les fichiers exportés restent accessibles à leurs utilisateurs.

## Lancer en développement

Pas d’installation nécessaire pour l’application. Python 3 suffit. Pour reproduire le sous-chemin de production, conserver le nom de dossier **X2** :

```sh
cd /workspace/X2
npm run serve
```

Ouvrir `/X2/` sur le serveur local au port 8000. Sans npm : `python3 -m http.server 8000 --bind 127.0.0.1 --directory /workspace`. `file://` ne convient pas aux modules ni au service worker. L’environnement cloud est déjà isolé : utiliser le checkout existant, sans créer de worktree.

## GitHub Pages — après approbation uniquement

Aucune publication n’est effectuée par ce changement. Après revue et approbation :

1. Fusionner les fichiers statiques sur `main`.
2. Dans le dépôt GitHub → Settings → Pages, choisir **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis enregistrer.
3. Vérifier HTTPS et le site `https://joem1306.github.io/X2/`.
4. Vérifier manifest, icônes, modules et service worker sous `/X2/`, puis effectuer la recette iPhone ci-dessous avant d’utiliser de vraies données.

Le fichier `.nojekyll` permet de servir directement les fichiers statiques. Aucun secret GitHub Actions ni build n’est requis. Les liens d’exécution sont relatifs ; le manifeste fixe explicitement le périmètre `/X2/`. Un changement de nom de dépôt exige de modifier `id`, `start_url`, `scope` du manifeste et les chemins des tests.

Ne publier que le code, les ressources et la documentation générique. Ne jamais ajouter de sauvegardes, vrais PDF médicaux, profils de navigateur ni données de patients au dépôt. Les fixtures de tests sont entièrement synthétiques ; les sorties de tests sont ignorées par Git.

## Hors ligne et mises à jour

Le service worker précache une liste exacte de ressources statiques. Attendre **Disponible hors ligne** avant de couper la connexion. Pas de mise en cache des exports, d’URL à paramètres ou de requêtes arbitraires. La première installation nécessite Internet et une mise en cache réussie.

À chaque modification d’un fichier précaché, **changer la constante `CACHE` dans `sw.js`** avant livraison. Une nouvelle version attend l’action « Mettre à jour ». Cette action active le worker puis recharge seulement la fenêtre qui l’a demandée, après fermeture des formulaires. Une activation depuis une autre fenêtre ne recharge jamais un formulaire en cours. IndexedDB n’est pas supprimé. Les anciens caches `x2-shell-*` sont nettoyés ; les autres caches de l’origine ne le sont pas.

Les processus, données de navigateur et connexions ne font pas partie du code : un nouveau contexte de navigateur démarre sans journal, sauf restauration JSON. Sauvegarder avant une mise à jour importante.

## Tests et limites de validation

Voir [docs/TESTING.md](docs/TESTING.md) pour les commandes, la couverture et la recette manuelle iPhone. Références fonctionnelles conservées dans [docs/PRD.md](docs/PRD.md) et [docs/ENGINEERING_DESIGN.md](docs/ENGINEERING_DESIGN.md) ; leurs mentions initiales d’autorisation décrivent leur état lors de rédaction. L’implémentation a été demandée explicitement dans la conversation.

La structure du rapport suit les intitulés du PRD. **L’image du formulaire médical original et la référence visuelle ne figuraient pas parmi les deux documents joints** : la fidélité exacte reste à vérifier contre ces références. Le parcours PDF et le cycle de vie d’une PWA iOS restent à valider sur appareil réel. Le déploiement et la fusion restent soumis à l’approbation du propriétaire.
