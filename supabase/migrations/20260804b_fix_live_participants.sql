-- Migration: Suppression de la table obsolète live_participants
-- La table live_participants est obsolète et a été remplacée par live_presence pour le suivi de présence en temps réel dans les Live Rooms.
-- Elle n'est plus utilisée dans l'application web. La supprimer permet d'éliminer les failles RLS associées.

DROP TABLE IF EXISTS live_participants CASCADE;
