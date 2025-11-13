📊 Éléments présents dans mastra.ts mais PAS dans prompt.md

Structure et organisation

1. Titre différent : "Agent Conversationnel WhatsApp" vs "Hôte virtuel WhatsApp"
2. Section "Ton Identité" : détails sur nom, slogan, type d'établissement
3. Règle critique sur le périmètre : section dédiée avec ✅ Questions ACCEPTÉES / ❌ Questions REFUSÉES

Comportement et règles critiques

4. Comportement Proactif : section entière sur quand proposer réservation, exemples de plats, etc.
5. RÈGLE CRITIQUE : Ne PAS suggérer le menu d'actions : interdiction explicite de mentionner un "menu d'options"
6. RÈGLE CRITIQUE : Gestion de l'Historique et Nouvelles Sessions : avec indicateur [NEW_SESSION_AFTER_BREAK]
7. RÈGLE CRITIQUE : Liens de Réservation : jamais mentionner sans donner le lien complet
8. Règles de Formatage WhatsApp : texte brut uniquement, pas de markdown
9. Règle du Premier Contact : comportement spécifique pour "bonjour/salut"

Informations détaillées

10. Détails sur la viande : partenariat éleveurs ligériens, bêtes avec accès libre, nourries sans OGM
11. Pain burger : artisanal brioché au sésame, toasté
12. Pain noir : au charbon fait maison
13. Fromages détaillés : tomme, raclette, meule paysanne, rigotte de La Coise
14. Plat du jour et dessert du jour en semaine
15. Découpe par boucher professionnel sur place
16. Bons cadeaux détaillés : minimum 50€, validité 365 jours, paiement MangoPay, cagnotte possible
17. Boutique : "Livre des recettes de la Loire" à 24,90€
18. Garderie : mention qu'elle n'est pas affiliée
21. Lieux détaillés : La Rotonde (158 Cours Fauriel), Planétarium (28 Rue Pierre et Dominique Ponchardier), etc.
22. Marché : mercredi et samedi 6h-13h avec attention stationnement

Photos et limitations

23. Section "Photos des plats - RÈGLE CRITIQUE" : avec exemple de réponse
24. Interdiction : NE JAMAIS SUGGÉRER D'ALTERNATIVES OU DE RESTAURANTS CONCURRENTS
25. Signature de Clôture : message spécifique avec emojis

Esprit

26. Section "Esprit La Java Bleue" : donner envie de venir manger

  ---
📊 Éléments présents dans prompt.md mais PAS dans mastra.ts

Style et ton

1. Section "Style et ton" plus développée avec exemples ✅/❌
2. Vouvoiement par défaut : mention explicite
3. "Rythme : lisible en 3 secondes"

Logique de réponse

4. Section "Logique de réponse (Intent → Action → Lien)" : structure complète avec exemples pour chaque cas d'usage
5. Exemples de réponses pour menu, plats, allergènes
6. Exemples de réponses pour groupes, anniversaires, privatisations
7. Exemples de réponses pour horaires, ouverture, affluence
8. Exemples de réponses pour contexte local (météo, match, marché)
9. Exemples de réponses pour questions annexes (parking, quartier, sécurité)
10. Exemples de réponses pour hors sujet total

Itinéraires

11. Sous-section "Réponse rapide" (sans point de départ précis)
12. Construction d'itinéraires mieux intégrée dans la section "Accès, transports, parking"

Contexte local

13. Section "Contexte local & service client" : liste des lieux connus
14. Exemples pratiques pour le contexte local

Réponses intelligentes

15. Section "Réponses intelligentes et adaptatives" : clarification, incertitude, conversation longue

Liens et coordonnées

16. Section dédiée "Liens et coordonnées officielles" : tous les liens en un seul endroit
17. Lien boutique : https://lajavableue.bonkdo.com/fr/shop/
18. "Toujours un seul lien pertinent par message. Jamais plus."

Photos

19. Section "Photos" plus concise (vs "RÈGLE CRITIQUE" dans mastra)

Clôture

20. Plusieurs options de clôture : "Avec plaisir...", "Bonne journée...", "Merci..."

Résumé

21. Section "Résumé d'ancrage" : 6 points-clés rappelant les principes essentiels

  ---
⚠️ Différences notables

Informations conflictuelles

- Tram : prompt.md dit "T3 direction Bellevue, arrêt Fauriel" / mastra.ts dit "T1 – Arrêt Centre Deux"
- Ton : mastra.ts utilise plus le tutoiement dans les exemples / prompt.md privilégie le vouvoiement

Organisation

- mastra.ts est plus axé sur les règles critiques et comportements proactifs
- prompt.md est plus axé sur les exemples de réponses et la structure conversationnelle