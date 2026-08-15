# Gestion des Dérives de Schéma et Migrations Supabase

## 1. Origine de la Dérive (Incident `live_sessions`)

La panne survenue lors de la création de séances en direct (`operator does not exist: uuid = text` et `column "entity_id" is of type uuid but expression is of type text`) a été causée par une **dérive de schéma (schema drift)**. 
Des objets SQL (le trigger `trg_log_live_session`, la fonction `log_live_session_event()`, et des policies RLS permissives) avaient été créés ou modifiés manuellement directement dans le dashboard Supabase Studio sans être documentés ni versionnés dans le dossier `supabase/migrations/` du projet. 
Le code applicatif et les migrations locales ne reflétaient donc plus l'état réel de la base de données, provoquant des ruptures de compatibilité de types de données.

---

## 2. Règle Obligatoire de Développement

> **Règle d'or : Zéro modification manuelle en production sans fichier de migration.**

1. **Tout changement de base de données** (création ou modification de table, colonne, fonction, trigger, contrainte ou policy RLS) **DOIT** faire l'objet d'un fichier SQL horodaté dans `supabase/migrations/` (ex: `supabase/migrations/YYYYMMDD_nom_du_changement.sql`).
2. **Aucune action directe** dans l'éditeur de table ou de policy de Supabase Studio ne doit être effectuée sans être immédiatement transcrite dans une migration commitée dans le dépôt Git.
3. Les scripts de migration doivent être idempotents (`IF EXISTS`, `IF NOT EXISTS`, `CREATE OR REPLACE`) pour être rejouables en toute sécurité.

---

## 3. Détecter et Auditer les Dérives

Un script SQL d'audit prêt à l'emploi est disponible dans le dépôt :
📁 **`supabase/scripts/audit_schema_drift.sql`**

### Comment l'utiliser :
1. Ouvrez votre **SQL Editor** dans le dashboard Supabase.
2. Collez le contenu de `supabase/scripts/audit_schema_drift.sql` et cliquez sur **Run**.
3. Le rapport listera immédiatement tous les objets :
   - `⚠️ NON VERSIONNÉ (DÉRIVE DÉTECTÉE)` : Objet présent en base mais absent du catalogue de migrations du code source.
   - `✅ VERSIONNÉ (CONFORME)` : Objet aligné avec les migrations Git.
