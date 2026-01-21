# Bitfocus Companion API Documentatie

Deze API maakt integratie met Bitfocus Companion mogelijk voor het aansturen van LED-schermen.

**Base URL:** `http://<server>:8080/api/companion`

---

## Authenticatie

Alle endpoints vereisen authenticatie wanneer `ADMIN_PASSWORD` is ingesteld.

### Methodes

1. **API Key Header** (aanbevolen voor Companion)
   ```
   x-api-key: <ADMIN_PASSWORD>
   ```

2. **Bearer Token**
   ```
   Authorization: Bearer <jwt-token>
   ```

---

## Endpoints Overzicht

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/displays` | Lijst alle displays |
| GET | `/screens` | Lijst alle schermen |
| GET | `/scenarios` | Lijst alle scenarios |
| GET | `/assignments` | Lijst alle scenario assignments met content type |
| GET | `/assignments/:screenId` | Lijst assignments voor specifiek scherm |
| GET | `/presets` | Lijst alle presets |
| POST | `/presets` | Maak nieuwe preset |
| PUT | `/presets/:id` | Wijzig preset |
| DELETE | `/presets/:id` | Verwijder preset |
| POST | `/presets/trigger` | Activeer preset |
| POST | `/scenarios/trigger` | Activeer scenario voor scherm |
| POST | `/screens/:id/content` | Zet content op scherm |

---

## Displays

### GET /displays

Haal alle displays op.

**Response:**
```json
[
  {
    "id": "display-1",
    "name": "Hoofddisplay",
    "_count": { "screens": 3 }
  }
]
```

---

## Screens

### GET /screens

Haal alle schermen op.

**Response:**
```json
[
  {
    "id": "screen-1",
    "name": "Linker Scherm",
    "displayId": "display-1"
  }
]
```

### POST /screens/:id/content

Zet direct content op een scherm.

**Request:**
```json
{
  "imageSrc": "/content/Algemeen/image.png"
}
```

**Response:**
```json
{ "success": true }
```

---

## Scenarios

### GET /scenarios

Haal alle scenario namen op.

**Response:**
```json
[
  { "id": "abc123", "name": "Scene 1" },
  { "id": "def456", "name": "Scene 2" }
]
```

### POST /scenarios/trigger

Activeer een scenario voor een specifiek scherm.

**Request:**
```json
{
  "screenId": "screen-1",
  "scenarioName": "Scene 1"
}
```

**Response:**
```json
{ "success": true }
```

**Errors:**
- `404` - Scenario assignment niet gevonden voor dit scherm

---

## Assignments

### GET /assignments

Haal alle scenario assignments op inclusief content type informatie (still image of slideshow).

**Response:**
```json
[
  {
    "screenId": "screen-1",
    "scenario": "Scene 1",
    "contentType": "still_image",
    "imagePath": "/content/Algemeen/logo.png",
    "intervalMs": null,
    "images": []
  },
  {
    "screenId": "screen-2",
    "scenario": "Scene 2",
    "contentType": "slideshow",
    "imagePath": "/content/Promo/slide1.png",
    "intervalMs": 5000,
    "images": [
      "/content/Promo/slide1.png",
      "/content/Promo/slide2.png",
      "/content/Promo/slide3.png"
    ]
  }
]
```

**Content Type waarden:**
- `still_image` - Enkele afbeelding (geen interval of slechts 1 afbeelding)
- `slideshow` - Meerdere afbeeldingen met interval

### GET /assignments/:screenId

Haal scenario assignments op voor een specifiek scherm.

**Response:**
```json
[
  {
    "screenId": "screen-1",
    "scenario": "Scene 1",
    "contentType": "still_image",
    "imagePath": "/content/Algemeen/logo.png",
    "intervalMs": null,
    "images": []
  }
]
```

**Errors:**
- `404` - Scherm niet gevonden

---

## Presets

### GET /presets

Haal alle presets op inclusief scenario mappings.

**Response:**
```json
[
  {
    "id": "xyz789",
    "name": "Show Mode",
    "scenarios": {
      "screen-1": "Scene 1",
      "screen-2": "Scene 2"
    }
  }
]
```

### POST /presets

Maak een nieuwe preset.

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
  "id": "abc123",
  "name": "Mijn Preset",
  "scenarios": {
    "screen-1": "Scene 1",
    "screen-2": "Scene 2"
  }
}
```

### PUT /presets/:id

Wijzig een bestaande preset. Beide velden zijn optioneel.

**Request:**
```json
{
  "name": "Nieuwe Naam",
  "scenarios": {
    "screen-1": "Scene 3"
  }
}
```

**Response:**
```json
{
  "id": "abc123",
  "name": "Nieuwe Naam",
  "scenarios": {
    "screen-1": "Scene 3"
  }
}
```

**Errors:**
- `404` - Preset niet gevonden

### DELETE /presets/:id

Verwijder een preset.

**Response:**
```json
{ "success": true }
```

**Errors:**
- `404` - Preset niet gevonden

### POST /presets/trigger

Activeer een preset. Dit zet alle schermen naar hun gekoppelde scenario content.

**Request:**
```json
{
  "presetId": "abc123"
}
```

**Response:**
```json
{ "success": true }
```

**Errors:**
- `404` - Preset niet gevonden

---

## Bitfocus Companion Configuratie

### Generic HTTP Module Instellen

1. Voeg een **Generic HTTP** module toe in Companion
2. Configureer de base URL: `http://<server-ip>:8080`
3. Voeg header toe: `x-api-key` met je `ADMIN_PASSWORD`

### Voorbeeld Actions

#### Preset Activeren (meest gebruikt)
```
Method: POST
Path: /api/companion/presets/trigger
Headers: Content-Type: application/json
Body: {"presetId": "$(internal:custom_preset_id)"}
```

#### Scenario Activeren voor Scherm
```
Method: POST
Path: /api/companion/scenarios/trigger
Headers: Content-Type: application/json
Body: {"screenId": "screen-1", "scenarioName": "Scene 1"}
```

#### Scherm Leegmaken
```
Method: POST
Path: /api/companion/screens/screen-1/content
Headers: Content-Type: application/json
Body: {"imageSrc": ""}
```

#### Preset Aanmaken
```
Method: POST
Path: /api/companion/presets
Headers: Content-Type: application/json
Body: {"name": "New Preset", "scenarios": {"screen-1": "Scene 1"}}
```

---

## Errors

Alle endpoints retourneren errors in dit formaat:

```json
{
  "error": "Beschrijving van de fout"
}
```

### HTTP Status Codes

| Code | Betekenis |
|------|-----------|
| 200 | Success |
| 201 | Created (bij POST /presets) |
| 400 | Bad Request - ongeldige input |
| 401 | Unauthorized - authenticatie vereist |
| 404 | Not Found - resource niet gevonden |
| 429 | Too Many Requests - rate limit bereikt |
| 500 | Server Error |

---

## Rate Limiting

De API heeft rate limiting om misbruik te voorkomen. Bij teveel requests krijg je een `429` status code.
