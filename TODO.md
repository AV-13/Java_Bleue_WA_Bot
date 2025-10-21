# TODO

A partir de scrap.md et du projet existant :
- ✅ Commenter toute mention à supabase pour l'instant
- ✅ Enlever toute mention à Caribbean Food Carbet et parler du nouveau restaurant Java Bleue
- ✅ Mettre à jour les informations de contact et l'adresse
- ✅ Mettre à jour les heures d'ouverture
- ✅ Mettre à jour le menu avec des spécialités (viandes françaises, burgers)
- ✅ Revoir le prompt pour correspondre au nouveau restaurant
- ✅ Conserver la gestion multilingues
- ✅ Ajouter des boutons interactifs quand c'est nécessaire pour rediriger vers des liens externes

TODO List
- ✅ Les boutons interactifs sont maintenant supportés pour le multilingue avec traduction dynamique par l'IA
- ✅ Menu déroulant interactif avec 9 actions : voir le menu, réserver, horaires, adresse, contact, livraison, vente à emporter, bons cadeaux, boutique
- ✅ Prompt enrichi dans mastra.ts avec toutes les informations du scrap.md (bons cadeaux, boutique, partenariats agriculteurs, etc.)*


- ✅ Message de bienvenue raccourci : maintenant juste "Bienvenue à La Java Bleue" (max 6 mots)
- ✅ Prompt modifié pour éviter les réponses à rallonge (maximum 2-3 phrases)
- ✅ Phrase "Je suis votre hôte virtuel..." complètement enlevée
- ✅ Liste déroulante affichée directement au premier message (bonjour/salut/hello)
- ✅ Comportement uniformisé dans toutes les langues (même ton et longueur, seule la langue change)

**Nouvelles améliorations :**
- ✅ Message d'introduction plus chaleureux (8-10 mots) : "Bienvenue à La Java Bleue ! Comment puis-je vous aider ?"
- ✅ Tirets supprimés des options du menu déroulant (nettoyage automatique)
- ✅ 100% traduit par l'IA : tous les textes (labels, descriptions, boutons, messages) sont traduits dynamiquement
- ✅ Aucun texte en dur (sauf fallback d'urgence si l'IA échoue complètement)

**Réponses aux options du menu déroulant - MULTILINGUE :**
- ✅ Cache de langue par utilisateur (24h) : mémorise la langue de l'utilisateur
- ✅ Si l'utilisateur parle polonais puis clique sur un bouton → réponse en POLONAIS
- ✅ Messages supprimés : "Here is our location" (juste le pin maintenant)
- ✅ Messages bien formatés : Contact avec 📞 et 🌐, Horaires courts et clairs
- ✅ Tous les messages courts et chaleureux (max 8-10 mots)
- ✅ 100% traduit dynamiquement par l'IA dans la langue de l'utilisateur

**Ajustement du ton et de la longueur :**
- ✅ Prompt modifié pour des réponses plus chaleureuses et naturelles
- ✅ Format : 3-5 phrases (au lieu de 2-3) pour être plus accueillant
- ✅ Ton : Conversationnel et sympathique, comme un serveur sympa qui aime discuter
- ✅ Émojis : 1-2 par message pour ajouter de la chaleur
- ✅ Ajoute des détails appétissants et une touche personnelle quand pertinent
- ✅ Messages des actions du menu allongés : 10-15 mots (au lieu de 8) pour plus de chaleur

**Multilingue universel + Mise en page :**
- ✅ Détection de salutations par IA (fonctionne dans TOUTES les langues : polonais, espagnol, allemand, etc.)
- ✅ Menu déroulant s'affiche peu importe la langue de salutation
- ✅ Bouton "Voir les options" traduit dynamiquement (ex: "Zobacz opcje" en polonais)
- ✅ Mise en page améliorée avec retours à la ligne pour :
  - Contact : chaque info sur une ligne (📞, 🌐)
  - Horaires : structuré avec émojis et détails
  - Bons cadeaux : détails sur plusieurs lignes (50€, 365 jours)
  - Boutique : livre de recettes avec prix (24.90€)

**Nettoyage du code - Suppression des références à Caribbean Food :**
- ✅ Fonction `getCaribbeanFoodAgent` renommée en `getJavaBleuAgent`
- ✅ Tous les imports mis à jour dans mastra.ts, dynamicTranslation.ts, webhook.ts
- ✅ Description du traducteur changée : "Caribbean Food Carbet" → "La Java Bleue"
- ✅ Message d'erreur fallback mis à jour avec les vraies coordonnées de La Java Bleue
- ✅ Plus aucune référence à Caribbean Food, Martinique, ou Carbet dans le code source

**FIX : Traduction norvégien → français (bug critique résolu) :**
- ✅ Problème diagnostiqué : codes ISO à 2 lettres (no, pl, es) mal compris par l'IA
- ✅ Solution : mapping des codes ISO vers noms complets (no → Norwegian, pl → Polish, etc.)
- ✅ Fonctions corrigées : `generateText`, `generateListLabels`, `generateReservationConfirmation`
- ✅ Support de 20+ langues : fr, en, es, de, it, pt, nl, pl, ru, ja, zh, ar, no, sv, da, fi, cs, el, tr, ko
- ✅ Prompts améliorés avec exemples explicites : "If language is Norwegian (no): translate to Norwegian, NOT French"
- ✅ Maintenant un message en norvégien "Hei hvordan gar det" obtient une réponse EN NORVÉGIEN