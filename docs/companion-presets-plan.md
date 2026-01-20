# Companion API: Presets CRUD Plan

## Huidige Situatie

De Companion API (`/api/companion/`) heeft al basis preset ondersteuning:
- `GET /presets` - Lijst presets (alleen id en name)
- `POST /presets/trigger` - Activeer een preset

## Gewenste Functionaliteit

Uitbreiding voor volledige preset CRUD via Companion:

1. **Presets ophalen** (uitbreiden) - inclusief scenario mappings
2. **Preset aanmaken** - via Companion
3. **Preset bijwerken** - naam en/of scenarios wijzigen
4. **Preset verwijderen** - via Companion

---

## API Endpoints

### 1. GET /api/companion/presets (uitbreiden)

Huidige response:
```json
[
  { "id": "abc123", "name": "Preset 1" }
]
```

Nieuwe response:
```json
[
  {
    "id": "abc123",
    "name": "Preset 1",
    "scenarios": {
      "screen-1": "Scene 1",
      "screen-2": "Scene 2"
    }
  }
]
```

### 2. POST /api/companion/presets (nieuw)

Maak een nieuwe preset aan.

**Request:**
```json
{
  "name": "Mijn Preset",
  "scenarios": {
    "screen-1": "Scene 1",
    "screen-2": "Scene 2"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "xyz789",
  "name": "Mijn Preset",
  "scenarios": {
    "screen-1": "Scene 1",
    "screen-2": "Scene 2"
  }
}
```

### 3. PUT /api/companion/presets/:id (nieuw)

Wijzig een bestaande preset.

**Request:**
```json
{
  "name": "Nieuwe Naam",
  "scenarios": {
    "screen-1": "Scene 3",
    "screen-2": "Scene 1"
  }
}
```

Beide velden zijn optioneel - alleen meegegeven velden worden bijgewerkt.

**Response (200 OK):**
```json
{
  "id": "xyz789",
  "name": "Nieuwe Naam",
  "scenarios": {
    "screen-1": "Scene 3",
    "screen-2": "Scene 1"
  }
}
```

### 4. DELETE /api/companion/presets/:id (nieuw)

Verwijder een preset.

**Response (200 OK):**
```json
{
  "success": true
}
```

**Response (404 Not Found):**
```json
{
  "error": "Preset not found"
}
```

---

## Implementatie

### Bestand: `/backend/src/routers/companion.ts`

#### Wijzigingen:

1. **GET /presets uitbreiden** - scenarios meesturen
2. **POST /presets toevoegen** - create functionaliteit
3. **PUT /presets/:id toevoegen** - update functionaliteit
4. **DELETE /presets/:id toevoegen** - delete functionaliteit

---

## Authenticatie

Alle endpoints gebruiken dezelfde `requireCompanionAuth` middleware:
- `x-api-key` header met ADMIN_PASSWORD
- Of `Authorization: Bearer <token>` header

---

## Gebruik in Bitfocus Companion

### Voorbeeld: Preset aanmaken via HTTP Request action

```
Method: POST
URL: http://localhost:8080/api/companion/presets
Headers:
  x-api-key: <your-password>
  Content-Type: application/json
Body: {"name": "Show Mode", "scenarios": {"screen-1": "Scene 1"}}
```

### Voorbeeld: Preset bijwerken

```
Method: PUT
URL: http://localhost:8080/api/companion/presets/abc123
Headers:
  x-api-key: <your-password>
  Content-Type: application/json
Body: {"name": "Updated Name"}
```

### Voorbeeld: Preset verwijderen

```
Method: DELETE
URL: http://localhost:8080/api/companion/presets/abc123
Headers:
  x-api-key: <your-password>
```

---

## Verificatie

1. **GET presets** - Controleer dat scenarios in response zit
2. **POST preset** - Maak preset, check in frontend dat deze verschijnt
3. **PUT preset** - Wijzig naam/scenarios, controleer in frontend
4. **DELETE preset** - Verwijder, controleer dat preset weg is
5. **Trigger preset** - Activeer aangepaste preset, controleer schermen
