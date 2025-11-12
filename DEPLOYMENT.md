# 🚀 Guide de Déploiement - La Java Bleue WhatsApp Bot

Ce guide vous explique comment déployer le bot WhatsApp de La Java Bleue sur Heroku avec un déploiement automatique via GitHub Actions.

## 📋 Prérequis

- Un compte [Heroku](https://www.heroku.com/)
- Un compte [GitHub](https://github.com/)
- Votre code poussé sur GitHub
- Les clés API Meta WhatsApp et OpenAI
- Les identifiants Supabase

---

## 🏗️ Étape 1 : Créer l'application Heroku

### 1.1 Via le Dashboard Heroku (Recommandé)

1. Connectez-vous à [Heroku Dashboard](https://dashboard.heroku.com/)
2. Cliquez sur **"New"** → **"Create new app"**
3. Nommez votre app (ex: `la-java-bleue-bot`)
4. Choisissez la région **Europe**
5. Cliquez sur **"Create app"**

### 1.2 Via la CLI Heroku (Alternative)

```bash
# Installer Heroku CLI si pas déjà fait
# Windows: https://devcenter.heroku.com/articles/heroku-cli
# macOS: brew install heroku/brew/heroku

# Se connecter à Heroku
heroku login

# Créer l'application
heroku create la-java-bleue-bot --region eu
```

---

## 🔐 Étape 2 : Configurer les Variables d'Environnement sur Heroku

### Via le Dashboard Heroku

1. Allez dans votre app sur Heroku Dashboard
2. Cliquez sur l'onglet **"Settings"**
3. Scrollez jusqu'à **"Config Vars"**
4. Cliquez sur **"Reveal Config Vars"**
5. Ajoutez les variables suivantes **UNE PAR UNE** :

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Environnement de production |
| `OPENAI_API_KEY` | `sk-proj-...` | Votre clé OpenAI API |
| `META_WHATSAPP_TOKEN` | `EAAT...` | Token d'accès Meta WhatsApp |
| `META_WHATSAPP_PHONE_NUMBER_ID` | `864553846733861` | ID du numéro WhatsApp |
| `META_WEBHOOK_VERIFY_TOKEN` | `your_custom_token` | Token de vérification webhook |
| `SUPABASE_URL` | `https://xxx.supabase.co` | URL de votre projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Clé service role Supabase |

### Via la CLI Heroku (Alternative)

```bash
heroku config:set NODE_ENV=production -a la-java-bleue-bot
heroku config:set OPENAI_API_KEY=sk-proj-... -a la-java-bleue-bot
heroku config:set META_WHATSAPP_TOKEN=EAAT... -a la-java-bleue-bot
heroku config:set META_WHATSAPP_PHONE_NUMBER_ID=864553846733861 -a la-java-bleue-bot
heroku config:set META_WEBHOOK_VERIFY_TOKEN=your_custom_token -a la-java-bleue-bot
heroku config:set SUPABASE_URL=https://xxx.supabase.co -a la-java-bleue-bot
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... -a la-java-bleue-bot
```

⚠️ **IMPORTANT** : Ne mettez PAS la variable `PORT` - Heroku la définit automatiquement.

---

## 🔑 Étape 3 : Configurer GitHub Actions

### 3.1 Obtenir votre Heroku API Key

1. Allez sur [Heroku Account Settings](https://dashboard.heroku.com/account)
2. Scrollez jusqu'à **"API Key"**
3. Cliquez sur **"Reveal"** et copiez la clé

### 3.2 Ajouter les Secrets GitHub

1. Allez sur votre repository GitHub
2. Cliquez sur **"Settings"** (en haut)
3. Dans le menu de gauche, cliquez sur **"Secrets and variables"** → **"Actions"**
4. Cliquez sur **"New repository secret"** et ajoutez :

| Name | Value |
|------|-------|
| `HEROKU_API_KEY` | Votre clé API Heroku |
| `HEROKU_APP_NAME` | `la-java-bleue-bot` |
| `HEROKU_EMAIL` | Votre email Heroku |

---

## 📦 Étape 4 : Déployer l'Application

### 4.1 Premier Déploiement

Maintenant que tout est configuré, poussez votre code sur GitHub :

```bash
# Ajouter tous les fichiers
git add .

# Créer un commit
git commit -m "feat: Configuration Heroku et GitHub Actions pour déploiement automatique"

# Pousser sur GitHub
git push origin main
```

✅ **GitHub Actions va automatiquement déployer sur Heroku !**

### 4.2 Vérifier le Déploiement

1. Allez dans l'onglet **"Actions"** de votre repo GitHub
2. Vous verrez le workflow **"Deploy to Heroku"** en cours
3. Attendez que le workflow soit terminé (icône verte ✅)

### 4.3 Vérifier que l'app fonctionne

```bash
# Via CLI
heroku logs --tail -a la-java-bleue-bot

# Via le navigateur
# Ouvrez: https://la-java-bleue-bot.herokuapp.com/
```

Vous devriez voir : `{"status":"ok","message":"WhatsApp Bot Server - La Java Bleue"}`

---

## 🔗 Étape 5 : Configurer le Webhook Meta WhatsApp

### 5.1 Obtenir l'URL Heroku

Votre URL webhook sera :
```
https://la-java-bleue-bot.herokuapp.com/webhook
```

### 5.2 Configurer dans Meta

1. Allez sur [Meta Developers](https://developers.facebook.com/)
2. Sélectionnez votre app WhatsApp
3. Dans le menu de gauche, allez dans **WhatsApp** → **Configuration**
4. Section **Webhook** :
   - **Callback URL** : `https://la-java-bleue-bot.herokuapp.com/webhook`
   - **Verify Token** : Votre `META_WEBHOOK_VERIFY_TOKEN`
   - Cliquez sur **"Verify and Save"**

5. **Abonnez-vous aux événements** :
   - Cochez `messages`
   - Cliquez sur **"Save"**

---

## 🔄 Déploiements Futurs (Automatiques)

Désormais, chaque fois que vous poussez du code sur la branche `main`, GitHub Actions déploiera automatiquement sur Heroku :

```bash
# Faire vos modifications
git add .
git commit -m "feat: Nouvelle fonctionnalité"
git push origin main

# ✅ Déploiement automatique sur Heroku !
```

---

## 📊 Monitoring et Logs

### Voir les logs en temps réel

```bash
heroku logs --tail -a la-java-bleue-bot
```

### Voir les logs sur le Dashboard

1. Allez sur Heroku Dashboard
2. Sélectionnez votre app
3. Cliquez sur **"More"** → **"View logs"**

### Redémarrer l'app

```bash
heroku restart -a la-java-bleue-bot
```

---

## 🛠️ Commandes Utiles

```bash
# Voir le status de l'app
heroku ps -a la-java-bleue-bot

# Ouvrir l'app dans le navigateur
heroku open -a la-java-bleue-bot

# Voir les variables d'environnement
heroku config -a la-java-bleue-bot

# Scaler l'app (1 dyno web)
heroku ps:scale web=1 -a la-java-bleue-bot

# Voir les derniers déploiements
heroku releases -a la-java-bleue-bot

# Rollback vers une version précédente (si problème)
heroku rollback -a la-java-bleue-bot
```

---

## 🚨 Troubleshooting

### L'app crash au démarrage

```bash
# Voir les logs
heroku logs --tail -a la-java-bleue-bot

# Vérifier que toutes les variables d'env sont définies
heroku config -a la-java-bleue-bot

# Redémarrer l'app
heroku restart -a la-java-bleue-bot
```

### Le webhook ne fonctionne pas

1. Vérifiez que l'app est bien démarrée : `heroku ps -a la-java-bleue-bot`
2. Testez l'URL : `curl https://la-java-bleue-bot.herokuapp.com/`
3. Vérifiez les logs : `heroku logs --tail -a la-java-bleue-bot`
4. Vérifiez que le `META_WEBHOOK_VERIFY_TOKEN` est correct

### GitHub Actions échoue

1. Vérifiez que les secrets GitHub sont bien configurés :
   - `HEROKU_API_KEY`
   - `HEROKU_APP_NAME`
   - `HEROKU_EMAIL`
2. Allez dans l'onglet **Actions** de GitHub et consultez les logs d'erreur

---

## 💰 Coûts Heroku

- **Plan Eco** : ~5-7$/mois (recommandé pour production)
- **Plan gratuit** : Supprimé depuis novembre 2022

Pour activer le plan Eco :
1. Allez dans votre app sur Heroku Dashboard
2. Onglet **"Resources"**
3. Cliquez sur **"Change Dyno Type"**
4. Sélectionnez **"Eco"**

---

## ✅ Checklist de Déploiement

- [ ] App Heroku créée
- [ ] Variables d'environnement configurées sur Heroku
- [ ] Secrets GitHub configurés (HEROKU_API_KEY, HEROKU_APP_NAME, HEROKU_EMAIL)
- [ ] Code poussé sur GitHub (branche main)
- [ ] GitHub Actions a déployé avec succès
- [ ] L'app répond sur `https://your-app.herokuapp.com/`
- [ ] Webhook Meta configuré avec l'URL Heroku
- [ ] Test d'envoi d'un message WhatsApp réussi

---

## 📞 Support

En cas de problème :
1. Consultez les logs Heroku : `heroku logs --tail -a la-java-bleue-bot`
2. Consultez les logs GitHub Actions
3. Vérifiez la documentation officielle :
   - [Heroku Node.js](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
   - [GitHub Actions](https://docs.github.com/en/actions)

---

**🎉 Félicitations ! Votre bot WhatsApp est maintenant en production sur Heroku avec déploiement automatique !**
