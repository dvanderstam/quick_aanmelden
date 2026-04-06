# Supabase Deployment Checklist

Gebruik deze checklist bij elke databasewijziging (bijv. nieuwe spelers of team-koppelingen).

## Spelers toevoegen of wijzigen

**Gebruik ALTIJD het sync-script.** Maak NOOIT handmatig auth users aan via de Supabase dashboard of losse SQL.

```bash
# Stap 1: Voeg spelers toe aan het inlognamen-bestand (formaat: "Naam: username")
# Stap 2: Draai het sync-script
npm run sync:team-players -- --team <team_id> --file <inlognamen.txt>

# Stap 3: Verifieer
npm run verify:players -- --team <team_id>
```

Het sync-script doet automatisch:
- Players aanmaken/updaten in de `players` tabel
- Team-koppelingen aanmaken in `player_teams`
- Auth users aanmaken met correct email-domein (`username@quick.local`)
- `auth_user_id` koppelen aan de player

> **Waarom?** Handmatig auth users aanmaken leidt tot fouten — bijv. verkeerd email-domein (`@quick.nl` i.p.v. `@quick.local`), waardoor spelers niet kunnen inloggen.

## Database-migraties (schema-wijzigingen)

1. Maak een nieuwe migratie in `supabase/` met oplopend versienummer, bijvoorbeeld `migration_v13_*.sql`.
2. Commit de migratie samen met eventuele app-wijzigingen.
3. Voer de migratie uit op productie via een van deze routes:
   - Supabase SQL Editor: plak en run de SQL uit de nieuwe migratie.
   - Supabase CLI: run de nog niet toegepaste migraties op de productie database.
4. Noteer kort in de PR of release-notes welke migratie is uitgevoerd.

## Snelle Verificatie Voor Nieuwe MH-2 Spelers

Gebruik deze query na spelers-mutaties voor MH-2:

```sql
SELECT p.id, p.name, p.username, pt.team_id
FROM players p
JOIN player_teams pt ON pt.player_id = p.id
WHERE pt.team_id = 'mh2'
  AND p.id IN (34, 35, 36, 37)
ORDER BY p.id;
```

Verwacht resultaat: 4 regels (Sven, Eric, Martin, Jayrone) met `team_id = 'mh2'`.

## Minimale Pre-Release Gate

Release pas als alle checks `OK` zijn:

- [ ] Spelers toegevoegd via `npm run sync:team-players` (NIET handmatig)
- [ ] `npm run verify:players` geeft geen fouten
- [ ] Inlognamenbestand is bijgewerkt
- [ ] Eventuele schema-migratie is uitgevoerd op productie
